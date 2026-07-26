import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import {
    parseObjectiveActorFromHeaders,
    type ObjectiveActor,
} from "../src/auth.js";
import {
    InMemoryObjectiveFeatureWindowRepository,
    type JsonObject,
    type ObjectiveFeatureWindowPersistenceInput,
} from "../src/featureStorage.js";
import {
    createObjectiveInterpretationPersistenceInput,
    InMemoryObjectiveInterpretationRepository,
} from "../src/interpretationStorage.js";
import {
    createObjectiveMlInferenceRequestFromFeatureWindow,
    type ObjectiveMlClient,
} from "../src/mlInferenceClient.js";
import {
    OBJECTIVE_ML_ALLOWED_TARGET,
    validateObjectiveMlInferenceResponse,
    type ObjectiveMlClass,
} from "../src/mlInferenceContract.js";
import {
    createObjectiveMlInferencePersistenceInput,
    InMemoryObjectiveMlInferenceRepository,
    type ObjectiveMlInferenceRecord,
} from "../src/mlInferenceStorage.js";
import {
    ingestObjectiveRawBatch,
    InMemoryObjectiveRawIngestionRepository,
    OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
} from "../src/rawIngestion.js";
import {
    createObjectiveSessionHistoryRepositoryFromSessions,
    getObjectiveSessionHistoryDetail,
    listObjectiveSessionHistoryForPatient,
} from "../src/sessionHistory.js";
import { buildObjectiveSessionReplayPayload } from "../src/sessionReplay.js";
import { buildObjectiveFinalSessionSummary } from "../src/sessionSummary.js";
import {
    createObjectiveSession,
    InMemoryObjectiveSessionRepository,
    requireSessionAccess,
    updateObjectiveSessionLifecycle,
} from "../src/sessionLifecycle.js";
import {
    InMemoryObjectiveSegmentManager,
    type ObjectiveSegmentRecord,
} from "../src/segmentManager.js";
import {
    createObjectiveFeatureWindowStreamEvent,
    createObjectiveInterpretationRecordStreamEvent,
    createObjectiveMlInferenceStreamEvent,
    serializeObjectiveClinicianStreamEvent,
} from "../src/streamEvents.js";
import type { ObjectiveTraceContext } from "../src/trace.js";
import {
    generateObjectiveRawBatch,
    generateObjectiveScenarioTimeline,
    type ObjectiveSimulatorScenarioId,
} from "../../../packages/objective-simulator/src/index.js";
import {
    buildObjectiveFeatureWindows,
    type ObjectiveFeatureWindowFoundation,
} from "../../../packages/objective-preprocessing/src/index.js";
import { mapObjectiveInterpretation } from "../../../packages/objective-interpretation/src/index.js";

const PATIENT_ID = "patient-stage13";
const DEVICE_ID = "device-stage13";
const DEVICE_BOOT_ID = "boot-stage13";

const trace: ObjectiveTraceContext = {
    requestId: "stage13-request",
    traceId: "stage13-trace",
};

const serviceActor: ObjectiveActor = {
    actorId: "objective-simulator-service",
    role: "service",
};

const assignedClinicianActor: ObjectiveActor = {
    actorId: "clinician-stage13",
    role: "clinician",
};

function fixedNow(): Date {
    return new Date("2026-06-02T10:00:00.000Z");
}

function makeAssignmentLookup(active = true): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment(clinicianId: string, patientId: string) {
            if (
                !active ||
                clinicianId !== assignedClinicianActor.actorId ||
                patientId !== PATIENT_ID
            ) {
                return null;
            }

            return {
                assignmentId: "assignment-stage13",
                clinicianId,
                patientId,
                status: "active",
            };
        },
    };
}

function toJsonObject(value: unknown): JsonObject {
    return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function expectNoUnsafeClinicianSurface(value: unknown): void {
    const serialized = JSON.stringify(value).toLowerCase();

    for (const forbidden of [
        "ecg_raw",
        "gsr_raw",
        "max_red",
        "max_ir",
        "max_green",
        "accel_x",
        "accel_y",
        "accel_z",
        "gyro_x",
        "gyro_y",
        "gyro_z",
        "mpu_temp_c",
        "tmp117_temp_c",
        "raw_payload",
        "craving_detected",
        "relapse_risk",
        "withdrawal_risk",
        "intoxication_detected",
        "aud_severity",
        "emergency_detected",
        "treatment_need",
        "detox_need",
        "medication_need",
        "ciwa_score",
        "sobriety_status",
        "patient_truthfulness",
        "patient_is_lying",
        "patient_is_safe",
        "patient_is_stable",
        "stress_proven",
        "relapse risk",
        "withdrawal risk",
        "intoxication summary",
        "craving summary",
        "risk score",
        "clinical alert",
        "emergency alert",
        "diagnosis",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

function expectClinicianOnlyVisibility(value: {
    clinician_visible: boolean;
    patient_visible: boolean;
    chatbot_visible: boolean;
}): void {
    expect({
        clinician_visible: value.clinician_visible,
        patient_visible: value.patient_visible,
        chatbot_visible: value.chatbot_visible,
    }).toEqual({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    });
}

function makeFeaturePersistenceInput(
    foundation: ObjectiveFeatureWindowFoundation,
    rawChunkRefs: readonly string[],
    windowIndex: number,
): ObjectiveFeatureWindowPersistenceInput {
    const heartDelta = windowIndex === 0 ? 8 : 3;
    const skinConductanceTrend = windowIndex === 0 ? 0.42 : 0.16;

    return {
        feature_window_key: foundation.feature_window_key,
        session_id: foundation.session_id,
        ...(foundation.segment_id ? { segment_id: foundation.segment_id } : {}),
        source_type: foundation.source_type,
        start_esp_time_ms: foundation.start_esp_time_ms,
        end_esp_time_ms: foundation.end_esp_time_ms,
        ...(foundation.start_pc_timestamp
            ? { start_pc_timestamp: foundation.start_pc_timestamp }
            : {}),
        ...(foundation.end_pc_timestamp
            ? { end_pc_timestamp: foundation.end_pc_timestamp }
            : {}),
        raw_batch_id: foundation.raw_batch_refs[0],
        raw_chunk_refs: [...rawChunkRefs],
        raw_range_refs: toJsonObject(foundation.raw_range_refs),
        preprocessing_version: foundation.preprocessing_version,
        feature_schema_version: foundation.feature_schema_version,
        window_status: "ready",
        suppression_state: "not_suppressed",
        quality: {
            motion_confound_index: 0.08,
            signal_quality_state: "usable",
        },
        missingness: {
            ecg: 0,
            gsr: 0,
            ppg: 0,
            imu: 0,
            temperature: 0,
        },
        modality_availability: {
            ecg: true,
            gsr: true,
            ppg: true,
            imu: true,
            temperature: true,
        },
        features: {
            ecg: {
                median_hr_bpm: 82,
                suppression: { suppressed: false, reasons: [] },
            },
            gsr: {
                tonic_trend_raw_per_min: 0.4,
                suppression: { suppressed: false, reasons: [] },
            },
            ppg: {
                pulse_rate_bpm: 80,
                suppression: { suppressed: false, reasons: [] },
            },
            imu: {
                activity_like_confound_index: 0.08,
                suppression: { suppressed: false, reasons: [] },
            },
            temperature: {
                tmp117_trend_c_per_min: 0.01,
                suppression: { suppressed: false, reasons: [] },
            },
        },
        baseline_relative: {
            baseline_state: "available",
            ecg_median_hr_delta_bpm: heartDelta,
            heart_activity_trend: heartDelta,
            gsr_tonic_delta: skinConductanceTrend,
            skin_conductance_trend: skinConductanceTrend,
            motion_confound_index: 0.08,
        },
        uncertainty_reasons: ["source_bound_simulator_context"],
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function createDeterministicMlClient(): ObjectiveMlClient {
    const predictions: readonly {
        predicted_class: ObjectiveMlClass;
        probability: number;
    }[] = [
        {
            predicted_class: "elevated_arousal_evidence",
            probability: 0.72,
        },
        {
            predicted_class: "recovery_cooldown",
            probability: 0.68,
        },
    ];

    let callIndex = 0;

    return {
        async infer(request) {
            expect(request.target).toBe(OBJECTIVE_ML_ALLOWED_TARGET);
            expect(request.session_id).toBeTruthy();
            expect(request.feature_window_id).toBeTruthy();

            const prediction = predictions[callIndex] ?? predictions[0];
            callIndex += 1;

            return validateObjectiveMlInferenceResponse({
                target: OBJECTIVE_ML_ALLOWED_TARGET,
                predicted_class: prediction.predicted_class,
                confidence_label: "moderate_confidence",
                probability: prediction.probability,
                uncertainty_reasons: ["source_bound_simulator_context"],
                suppression_state: "not_suppressed",
                model_version: "objective-ml-bounded-e2e-v1",
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            });
        },
    };
}

function makeReplayRepository(
    sessions: InMemoryObjectiveSessionRepository,
    features: InMemoryObjectiveFeatureWindowRepository,
    interpretations: InMemoryObjectiveInterpretationRepository,
    segments: InMemoryObjectiveSegmentManager,
) {
    return {
        getSession: sessions.getSession.bind(sessions),
        async listFeatureWindowsForSession(sessionId: string) {
            return features.listFeatureWindowsForSession({ session_id: sessionId });
        },
        async listInterpretationsForSession(sessionId: string) {
            return interpretations.listInterpretationsForSession({
                session_id: sessionId,
            });
        },
        async listSegmentsForSession(
            sessionId: string,
        ): Promise<ObjectiveSegmentRecord[]> {
            return segments.listSegmentsForSession(sessionId);
        },
    };
}

function makeSummaryRepository(
    sessions: InMemoryObjectiveSessionRepository,
    features: InMemoryObjectiveFeatureWindowRepository,
    interpretations: InMemoryObjectiveInterpretationRepository,
    mlInferences: InMemoryObjectiveMlInferenceRepository,
) {
    return {
        getSession: sessions.getSession.bind(sessions),
        async listFeatureWindowsForSession(sessionId: string) {
            return features.listFeatureWindowsForSession({ session_id: sessionId });
        },
        async listInterpretationsForSession(sessionId: string) {
            return interpretations.listInterpretationsForSession({
                session_id: sessionId,
            });
        },
        async listMlInferencesForSession(
            sessionId: string,
        ): Promise<ObjectiveMlInferenceRecord[]> {
            return mlInferences.listMlInferencesForSession({
                session_id: sessionId,
            });
        },
    };
}

describe("Stage 13 simulator-to-dashboard happy-path E2E", () => {
    it("moves simulator data through clinician-safe objective surfaces without patient/chatbot leakage", async () => {
        const assignments = makeAssignmentLookup();
        const sessions = new InMemoryObjectiveSessionRepository(fixedNow);
        const rawIngestion = new InMemoryObjectiveRawIngestionRepository(fixedNow);
        const segmentManager = new InMemoryObjectiveSegmentManager(fixedNow);
        const featureWindows = new InMemoryObjectiveFeatureWindowRepository(fixedNow);
        const mlInferences = new InMemoryObjectiveMlInferenceRepository(fixedNow);
        const interpretations = new InMemoryObjectiveInterpretationRepository(
            fixedNow,
        );

        for (const scenarioId of [
            "baseline_rest",
            "elevated_arousal_pattern",
            "recovery_cooldown",
        ] satisfies ObjectiveSimulatorScenarioId[]) {
            const timeline = generateObjectiveScenarioTimeline({
                scenario_id: scenarioId,
                seed: 61,
                duration_ms: 3_000,
            });
            const rawBatch = generateObjectiveRawBatch({
                batch_id: `schema-smoke-${scenarioId}`,
                timeline,
                session_id: "schema-smoke-session",
                device_id: DEVICE_ID,
                device_boot_id: DEVICE_BOOT_ID,
                sample_interval_ms: 1_000,
            });

            expect(rawBatch.source_type).toBe("simulator");
            expect(rawBatch.schema_version).toBe(
                OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
            );
            expect(rawBatch.frames.length).toBeGreaterThan(0);
            expect(rawBatch.frames[0]).toHaveProperty("frame.esp_time_ms");
            expect(rawBatch.frames[0]).toHaveProperty("frame.pc_timestamp");
        }

        const createSessionResult = await createObjectiveSession(
            serviceActor,
            {
                patient_id: PATIENT_ID,
                source_type: "simulator",
                device_id: DEVICE_ID,
                device_boot_id: DEVICE_BOOT_ID,
            },
            {
                sessions,
                assignments,
                now: fixedNow,
            },
            trace,
        );

        expect(createSessionResult.allowed).toBe(true);
        if (!createSessionResult.allowed) {
            throw new Error("Expected service actor to create simulator session");
        }

        const session = createSessionResult.value;
        expectClinicianOnlyVisibility(session);

        const startResult = await updateObjectiveSessionLifecycle(
            serviceActor,
            session.session_id,
            "start",
            {
                sessions,
                assignments,
                now: fixedNow,
            },
            trace,
        );

        expect(startResult.allowed).toBe(true);

        const timeline = generateObjectiveScenarioTimeline({
            scenario_id: "elevated_arousal_pattern",
            seed: 61,
            duration_ms: 60_000,
        });

        expect(timeline.phases.map((phase) => phase.phase_type)).toEqual([
            "baseline_period",
            "elevated_arousal_period",
            "recovery_period",
        ]);

        const simulatorBatch = generateObjectiveRawBatch({
            batch_id: "stage13-happy-path-batch",
            timeline,
            session_id: session.session_id,
            device_id: DEVICE_ID,
            device_boot_id: DEVICE_BOOT_ID,
            sample_interval_ms: 1_000,
        });

        const ingestResult = await ingestObjectiveRawBatch(
            serviceActor,
            {
                ...simulatorBatch,
                frames: simulatorBatch.frames.map((envelope) => envelope.frame),
            },
            {
                sessions,
                assignments,
                rawIngestion,
                segmentManager,
                now: fixedNow,
            },
            trace,
        );

        expect(ingestResult.allowed).toBe(true);
        if (!ingestResult.allowed) {
            throw new Error("Expected simulator batch ingestion to succeed");
        }

        expect(ingestResult.value.accepted_frame_count).toBe(
            simulatorBatch.frames.length,
        );
        expect(ingestResult.value.quarantined_frame_count).toBe(0);
        expect(ingestResult.value.chunks.length).toBeGreaterThan(0);

        const segments = await segmentManager.listSegmentsForSession(
            session.session_id,
        );
        expect(segments.length).toBeGreaterThan(0);
        expectClinicianOnlyVisibility(segments[0]);

        const firstSegmentId = segments[0].segment_id;
        const preprocessingBatch = {
            ...simulatorBatch,
            segment_id: firstSegmentId,
            frames: simulatorBatch.frames.map((envelope) => ({
                ...envelope,
                segment_id: firstSegmentId,
            })),
        };

        const featureFoundations = buildObjectiveFeatureWindows({
            batches: [preprocessingBatch],
            window_duration_ms: 30_000,
            step_ms: 30_000,
            expected_sample_interval_ms: 1_000,
            min_frames_per_window: 5,
        }).slice(0, 2);

        expect(featureFoundations.length).toBeGreaterThanOrEqual(2);

        const rawTraceability =
            await rawIngestion.listClinicianSafeChunkTraceability(
                session.session_id,
            );

        expect(rawTraceability.length).toBeGreaterThan(0);
        expectNoUnsafeClinicianSurface(rawTraceability);

        const rawChunkRefs = rawTraceability.map((chunk) => chunk.raw_chunk_id);

        const persistedFeatureWindows = await featureWindows.saveFeatureWindows(
            featureFoundations.map((foundation, index) =>
                makeFeaturePersistenceInput(foundation, rawChunkRefs, index),
            ),
        );

        expect(persistedFeatureWindows).toHaveLength(2);
        for (const featureWindow of persistedFeatureWindows) {
            expectClinicianOnlyVisibility(featureWindow);
        }

        const mlClient = createDeterministicMlClient();
        const savedMlInferences = [];

        for (const featureWindow of persistedFeatureWindows) {
            const request = createObjectiveMlInferenceRequestFromFeatureWindow(
                featureWindow,
                {
                    request_id: `stage13:${featureWindow.feature_window_key}`,
                    timeout_ms: 1_000,
                },
            );
            const response = await mlClient.infer(request);
            const savedMlInference = await mlInferences.saveMlInference(
                createObjectiveMlInferencePersistenceInput({
                    feature_window_id: featureWindow.id,
                    feature_window_key: featureWindow.feature_window_key,
                    session_id: featureWindow.session_id,
                    ...(featureWindow.segment_id
                        ? { segment_id: featureWindow.segment_id }
                        : {}),
                    response,
                    request_metadata: {
                        request_id: request.request_id,
                    },
                }),
            );

            savedMlInferences.push(savedMlInference);
            expectClinicianOnlyVisibility(savedMlInference);
        }

        const savedInterpretations = [];

        for (const [index, featureWindow] of persistedFeatureWindows.entries()) {
            const mlInference = savedMlInferences[index];
            const decision = mapObjectiveInterpretation({
                feature_window: {
                    feature_window_id: featureWindow.id,
                    feature_window_key: featureWindow.feature_window_key,
                    session_id: featureWindow.session_id,
                    ...(featureWindow.segment_id
                        ? { segment_id: featureWindow.segment_id }
                        : {}),
                    source_type: featureWindow.source_type,
                    window_status: featureWindow.window_status,
                    suppression_state: featureWindow.suppression_state,
                    quality: featureWindow.quality,
                    missingness: featureWindow.missingness,
                    modality_availability: featureWindow.modality_availability,
                    features: featureWindow.features,
                    baseline_relative: featureWindow.baseline_relative,
                    cross_signal: {
                        signal_conflict_score: 0,
                        high_motion_confound_present: false,
                    },
                    uncertainty_reasons: featureWindow.uncertainty_reasons,
                    visibility: {
                        clinician_visible: true,
                        patient_visible: false,
                        chatbot_visible: false,
                    },
                },
                ml_inference: {
                    ml_inference_id: mlInference.id,
                    model_version: mlInference.model_version,
                    target: mlInference.target,
                    predicted_class: mlInference.predicted_class,
                    confidence_label: mlInference.confidence_label,
                    probability: mlInference.probability,
                    uncertainty_reasons: mlInference.uncertainty_reasons,
                    suppression_state: mlInference.suppression_state,
                    visibility: {
                        clinician_visible: true,
                        patient_visible: false,
                        chatbot_visible: false,
                    },
                },
                artifact_state: {
                    source_banner: "simulated_data",
                    model_loaded: true,
                    model_version: mlInference.model_version,
                    preprocessing_version: featureWindow.preprocessing_version,
                    feature_schema_version: featureWindow.feature_schema_version,
                },
            });

            const savedInterpretation = await interpretations.saveInterpretation(
                createObjectiveInterpretationPersistenceInput({
                    decision: decision as unknown as JsonObject,
                }),
            );

            savedInterpretations.push(savedInterpretation);
            expectClinicianOnlyVisibility(savedInterpretation);
        }

        expect(
            savedInterpretations.map((record) => record.interpretation_label),
        ).toEqual([
            "elevated_physiological_arousal_evidence",
            "recovery_cooldown_evidence",
        ]);

        const stopResult = await updateObjectiveSessionLifecycle(
            serviceActor,
            session.session_id,
            "stop",
            {
                sessions,
                assignments,
                now: fixedNow,
            },
            trace,
        );

        expect(stopResult.allowed).toBe(true);

        const clinicianAccess = await requireSessionAccess(
            assignedClinicianActor,
            session.session_id,
            {
                sessions,
                assignments,
                now: fixedNow,
            },
            trace,
        );

        expect(clinicianAccess.allowed).toBe(true);

        const unassignedAccess = await requireSessionAccess(
            {
                actorId: "clinician-unassigned",
                role: "clinician",
            },
            session.session_id,
            {
                sessions,
                assignments,
                now: fixedNow,
            },
            trace,
        );

        expect(unassignedAccess.allowed).toBe(false);

        const patientDenied = parseObjectiveActorFromHeaders(
            {
                "x-objective-role": "patient",
                "x-objective-actor-id": "patient-stage13",
            },
            trace,
        );
        const chatbotDenied = parseObjectiveActorFromHeaders(
            {
                "x-objective-role": "chatbot",
                "x-objective-actor-id": "chatbot-stage13",
            },
            trace,
        );

        expect(patientDenied.allowed).toBe(false);
        expect(chatbotDenied.allowed).toBe(false);

        const historyRepository =
            createObjectiveSessionHistoryRepositoryFromSessions(sessions);

        const history = await listObjectiveSessionHistoryForPatient(
            historyRepository,
            PATIENT_ID,
            fixedNow,
        );
        const detail = await getObjectiveSessionHistoryDetail(
            historyRepository,
            session.session_id,
            fixedNow,
        );

        expect(history).toHaveLength(1);
        expect(history[0].source_banner).toBe("simulated_data");
        expect(detail?.visibility).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });

        const replay = await buildObjectiveSessionReplayPayload(
            makeReplayRepository(
                sessions,
                featureWindows,
                interpretations,
                segmentManager,
            ),
            session.session_id,
            fixedNow,
        );

        expect(replay).not.toBeNull();
        if (!replay) {
            throw new Error("Expected replay payload");
        }

        expect(replay.source_banner).toBe("simulated_data");
        expect(replay.replay_banner).toBe("historical_non_live_replay");
        expect(replay.feature_windows).toHaveLength(2);
        expect(replay.interpretation_timeline).toHaveLength(2);
        expect(replay.chart_ready_samples.length).toBeGreaterThan(0);

        const finalSummary = await buildObjectiveFinalSessionSummary(
            makeSummaryRepository(
                sessions,
                featureWindows,
                interpretations,
                mlInferences,
            ),
            session.session_id,
            fixedNow,
        );

        expect(finalSummary).not.toBeNull();
        if (!finalSummary) {
            throw new Error("Expected final summary");
        }

        expect(finalSummary.visibility).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });
        expect(finalSummary.total_windows).toBe(2);
        expect(finalSummary.evidence_periods).toHaveLength(1);
        expect(finalSummary.cooldown_periods).toHaveLength(1);
        expect(finalSummary.version_metadata.model_versions).toEqual([
            "objective-ml-bounded-e2e-v1",
        ]);

        const streamEvents = [
            serializeObjectiveClinicianStreamEvent(
                createObjectiveFeatureWindowStreamEvent(persistedFeatureWindows[0]),
            ),
            serializeObjectiveClinicianStreamEvent(
                createObjectiveMlInferenceStreamEvent(savedMlInferences[0]),
            ),
            serializeObjectiveClinicianStreamEvent(
                createObjectiveInterpretationRecordStreamEvent(
                    savedInterpretations[0],
                ),
            ),
        ];

        for (const event of streamEvents) {
            expect(event.session_id).toBe(session.session_id);
            expect(event.visibility).toEqual({
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            });
        }

        expectNoUnsafeClinicianSurface({
            rawTraceability,
            history,
            detail,
            replay,
            finalSummary,
            streamEvents,
        });
    });
});
