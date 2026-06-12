import type { ObjectiveAssignmentLookup } from "../src/assignments.js";
import type { ObjectiveActor } from "../src/auth.js";
import {
    InMemoryObjectiveFeatureWindowRepository,
    type JsonObject,
    type ObjectiveFeatureSuppressionState,
    type ObjectiveFeatureWindowPersistenceInput,
    type ObjectiveFeatureWindowRecord,
    type ObjectiveFeatureWindowStatus,
} from "../src/featureStorage.js";
import {
    createObjectiveInterpretationPersistenceInput,
    InMemoryObjectiveInterpretationRepository,
} from "../src/interpretationStorage.js";
import { createObjectiveMlInferenceRequestFromFeatureWindow } from "../src/mlInferenceClient.js";
import {
    OBJECTIVE_ML_ALLOWED_TARGET,
    validateObjectiveMlInferenceResponse,
    type ObjectiveMlClass,
} from "../src/mlInferenceContract.js";
import {
    createObjectiveMlInferencePersistenceInput,
    InMemoryObjectiveMlInferenceRepository,
} from "../src/mlInferenceStorage.js";
import {
    ingestObjectiveRawBatch,
    InMemoryObjectiveRawIngestionRepository,
} from "../src/rawIngestion.js";
import { buildObjectiveSessionReplayPayload } from "../src/sessionReplay.js";
import { buildObjectiveFinalSessionSummary } from "../src/sessionSummary.js";
import {
    createObjectiveSession,
    InMemoryObjectiveSessionRepository,
    updateObjectiveSessionLifecycle,
} from "../src/sessionLifecycle.js";
import { InMemoryObjectiveSegmentManager } from "../src/segmentManager.js";
import {
    createObjectiveInterpretationRecordStreamEvent,
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

const PATIENT_ID = "patient-stage13-degraded";
const DEVICE_ID = "device-stage13-degraded";
const DEVICE_BOOT_ID = "boot-stage13-degraded";

const trace: ObjectiveTraceContext = {
    requestId: "stage13-degraded-request",
    traceId: "stage13-degraded-trace",
};

const serviceActor: ObjectiveActor = {
    actorId: "objective-simulator-service",
    role: "service",
};

function fixedNow(): Date {
    return new Date("2026-06-02T11:00:00.000Z");
}

function makeAssignmentLookup(): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment() {
            return null;
        },
    };
}

function toJsonObject(value: unknown): JsonObject {
    return JSON.parse(JSON.stringify(value)) as JsonObject;
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

function expectNestedClinicianOnlyVisibility(value: {
    visibility: {
        clinician_visible: boolean;
        patient_visible: boolean;
        chatbot_visible: boolean;
    };
}): void {
    expect(value.visibility).toEqual({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    });
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
        "withdrawal concern",
        "intoxication summary",
        "craving summary",
        "clinical alert",
        "emergency alert",
        "risk score",
        "diagnosis",
        "treatment-need score",
        "detox need",
        "medication need",
        "sobriety status",
        "patient is safe",
        "patient is stable",
        "patient is lying",
        "chatbot_visible\":true",
        "patient_visible\":true",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

type DegradedCase = {
    name: string;
    scenarioId: ObjectiveSimulatorScenarioId;
    windowStatus: ObjectiveFeatureWindowStatus;
    featureSuppressionState: ObjectiveFeatureSuppressionState;
    ml:
        | {
              predictedClass: ObjectiveMlClass;
              probability: number;
              confidenceLabel:
                  | "insufficient_confidence"
                  | "low_confidence"
                  | "moderate_confidence";
              suppressionState: ObjectiveFeatureSuppressionState;
              uncertaintyReasons: string[];
          }
        | "unavailable";
    quality: JsonObject;
    missingness: JsonObject;
    modalityAvailability: JsonObject;
    features: JsonObject;
    baselineRelative: JsonObject;
    crossSignal: JsonObject;
    uncertaintyReasons: string[];
    expected: {
        interpretationLabel: string;
        suppressionState: ObjectiveFeatureSuppressionState;
        confidenceLabel:
            | "insufficient_confidence"
            | "low_confidence"
            | "moderate_confidence";
        uncertaintyReasons: string[];
        excludedModalities?: string[];
    };
};

function baseQuality(overrides: JsonObject = {}): JsonObject {
    return {
        motion_confound_index: 0.08,
        signal_quality_state: "usable",
        window_frame_count: 30,
        expected_frame_count: 30,
        ...overrides,
    };
}

function baseMissingness(overrides: JsonObject = {}): JsonObject {
    return {
        ecg: 0,
        gsr: 0,
        ppg: 0,
        imu: 0,
        temperature: 0,
        ...overrides,
    };
}

function baseModalityAvailability(overrides: JsonObject = {}): JsonObject {
    return {
        ecg: true,
        gsr: true,
        ppg: true,
        imu: true,
        temperature: true,
        ...overrides,
    };
}

function baseFeatures(overrides: JsonObject = {}): JsonObject {
    return {
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
        ...overrides,
    };
}

function baseBaselineRelative(overrides: JsonObject = {}): JsonObject {
    return {
        baseline_state: "available",
        readiness_confidence_modifier: 1,
        ecg_median_hr_delta_bpm: 8,
        heart_activity_trend: 8,
        gsr_tonic_delta: 0.42,
        skin_conductance_trend: 0.42,
        motion_confound_index: 0.08,
        ...overrides,
    };
}

function makeFeaturePersistenceInput(
    foundation: ObjectiveFeatureWindowFoundation,
    rawChunkRefs: readonly string[],
    scenario: DegradedCase,
): ObjectiveFeatureWindowPersistenceInput {
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
        window_status: scenario.windowStatus,
        suppression_state: scenario.featureSuppressionState,
        quality: scenario.quality,
        missingness: scenario.missingness,
        modality_availability: scenario.modalityAvailability,
        features: scenario.features,
        baseline_relative: scenario.baselineRelative,
        uncertainty_reasons: scenario.uncertaintyReasons,
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function toMapperFeatureWindow(
    featureWindow: ObjectiveFeatureWindowRecord,
    scenario: DegradedCase,
) {
    return {
        feature_window_id: featureWindow.id,
        feature_window_key: featureWindow.feature_window_key,
        session_id: featureWindow.session_id,
        ...(featureWindow.segment_id ? { segment_id: featureWindow.segment_id } : {}),
        source_type: featureWindow.source_type,
        window_status: featureWindow.window_status,
        suppression_state: featureWindow.suppression_state,
        quality: featureWindow.quality,
        missingness: featureWindow.missingness,
        modality_availability: featureWindow.modality_availability,
        features: featureWindow.features,
        baseline_relative: featureWindow.baseline_relative,
        cross_signal: scenario.crossSignal,
        uncertainty_reasons: featureWindow.uncertainty_reasons,
        visibility: {
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        } as const,
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
        async listSegmentsForSession(sessionId: string) {
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
        async listMlInferencesForSession(sessionId: string) {
            return mlInferences.listMlInferencesForSession({
                session_id: sessionId,
            });
        },
    };
}

const degradedCases: readonly DegradedCase[] = [
    {
        name: "motion artifact",
        scenarioId: "motion_artifact",
        windowStatus: "ready",
        featureSuppressionState: "not_suppressed",
        ml: {
            predictedClass: "elevated_arousal_evidence",
            probability: 0.78,
            confidenceLabel: "moderate_confidence",
            suppressionState: "not_suppressed",
            uncertaintyReasons: ["source_bound_simulator_context"],
        },
        quality: baseQuality({
            motion_confound_index: 0.86,
            signal_quality_state: "motion_confounded",
        }),
        missingness: baseMissingness(),
        modalityAvailability: baseModalityAvailability(),
        features: baseFeatures({
            imu: {
                activity_like_confound_index: 0.86,
                suppression: { suppressed: false, reasons: [] },
            },
        }),
        baselineRelative: baseBaselineRelative({
            motion_confound_index: 0.86,
        }),
        crossSignal: {
            signal_conflict_score: 0.2,
            high_motion_confound_present: true,
            motion_confound_index: 0.86,
        },
        uncertaintyReasons: ["motion_artifact_context"],
        expected: {
            interpretationLabel: "motion_confounded_evidence",
            suppressionState: "suppressed_motion_confound",
            confidenceLabel: "insufficient_confidence",
            uncertaintyReasons: [
                "motion_artifact_context",
                "motion_confound_present",
                "suppressed_motion_confound",
            ],
        },
    },
    {
        name: "poor contact",
        scenarioId: "poor_contact",
        windowStatus: "ready",
        featureSuppressionState: "suppressed_low_quality",
        ml: {
            predictedClass: "elevated_arousal_evidence",
            probability: 0.74,
            confidenceLabel: "moderate_confidence",
            suppressionState: "not_suppressed",
            uncertaintyReasons: ["source_bound_simulator_context"],
        },
        quality: baseQuality({
            signal_quality_state: "contact_limited",
            contact_quality_state: "limited",
        }),
        missingness: baseMissingness(),
        modalityAvailability: baseModalityAvailability(),
        features: baseFeatures({
            ecg: {
                median_hr_bpm: 0,
                suppression: {
                    suppressed: true,
                    reasons: ["poor_contact"],
                },
            },
            gsr: {
                tonic_trend_raw_per_min: 0,
                suppression: {
                    suppressed: true,
                    reasons: ["poor_contact"],
                },
            },
        }),
        baselineRelative: baseBaselineRelative(),
        crossSignal: {
            signal_conflict_score: 0.1,
            high_motion_confound_present: false,
            motion_confound_index: 0.1,
        },
        uncertaintyReasons: ["poor_contact", "signal_quality_limitation"],
        expected: {
            interpretationLabel: "suppressed_for_quality",
            suppressionState: "suppressed_low_quality",
            confidenceLabel: "insufficient_confidence",
            uncertaintyReasons: [
                "poor_contact",
                "signal_quality_limitation",
                "low_or_insufficient_signal_quality",
                "suppressed_low_quality",
            ],
            excludedModalities: ["ecg", "gsr"],
        },
    },
    {
        name: "sensor dropout",
        scenarioId: "sensor_dropout",
        windowStatus: "insufficient_data",
        featureSuppressionState: "suppressed_missing_data",
        ml: {
            predictedClass: "insufficient_reliable_data",
            probability: 0,
            confidenceLabel: "insufficient_confidence",
            suppressionState: "suppressed_missing_data",
            uncertaintyReasons: ["dropout_or_interrupted_signal_context"],
        },
        quality: baseQuality({
            signal_quality_state: "dropout_limited",
        }),
        missingness: baseMissingness({
            ecg: 0.6,
            gsr: 0.55,
            ppg: 0.7,
        }),
        modalityAvailability: baseModalityAvailability({
            ecg: false,
            gsr: false,
            ppg: false,
        }),
        features: baseFeatures(),
        baselineRelative: baseBaselineRelative(),
        crossSignal: {
            signal_conflict_score: 0.1,
            high_motion_confound_present: false,
            motion_confound_index: 0.1,
        },
        uncertaintyReasons: ["sensor_dropout", "missingness_limited"],
        expected: {
            interpretationLabel: "insufficient_reliable_data",
            suppressionState: "suppressed_missing_data",
            confidenceLabel: "insufficient_confidence",
            uncertaintyReasons: [
                "sensor_dropout",
                "missingness_limited",
                "dropout_or_interrupted_signal_context",
                "low_or_insufficient_signal_quality",
                "suppressed_missing_data",
            ],
        },
    },
    {
        name: "signal conflict",
        scenarioId: "signal_conflict",
        windowStatus: "ready",
        featureSuppressionState: "not_suppressed",
        ml: {
            predictedClass: "elevated_arousal_evidence",
            probability: 0.76,
            confidenceLabel: "moderate_confidence",
            suppressionState: "not_suppressed",
            uncertaintyReasons: ["source_bound_simulator_context"],
        },
        quality: baseQuality(),
        missingness: baseMissingness(),
        modalityAvailability: baseModalityAvailability(),
        features: baseFeatures(),
        baselineRelative: baseBaselineRelative(),
        crossSignal: {
            signal_conflict_score: 0.82,
            high_motion_confound_present: false,
            motion_confound_index: 0.08,
        },
        uncertaintyReasons: ["ecg_ppg_disagreement", "hr_gsr_divergence"],
        expected: {
            interpretationLabel: "signal_conflict_uncertain",
            suppressionState: "suppressed_signal_conflict",
            confidenceLabel: "insufficient_confidence",
            uncertaintyReasons: [
                "ecg_ppg_disagreement",
                "hr_gsr_divergence",
                "signal_conflict_high",
                "suppressed_signal_conflict",
            ],
        },
    },
    {
        name: "timing gap",
        scenarioId: "device_reset_or_timing_gap",
        windowStatus: "insufficient_data",
        featureSuppressionState: "suppressed_missing_data",
        ml: {
            predictedClass: "insufficient_reliable_data",
            probability: 0,
            confidenceLabel: "insufficient_confidence",
            suppressionState: "suppressed_missing_data",
            uncertaintyReasons: ["timing_or_segment_continuity_limitation"],
        },
        quality: baseQuality({
            timing_gap_count: 1,
            signal_quality_state: "timing_limited",
        }),
        missingness: baseMissingness(),
        modalityAvailability: baseModalityAvailability(),
        features: baseFeatures(),
        baselineRelative: baseBaselineRelative(),
        crossSignal: {
            signal_conflict_score: 0.1,
            high_motion_confound_present: false,
            motion_confound_index: 0.1,
        },
        uncertaintyReasons: ["timing_gap_detected", "segment_continuity_limited"],
        expected: {
            interpretationLabel: "insufficient_reliable_data",
            suppressionState: "suppressed_missing_data",
            confidenceLabel: "insufficient_confidence",
            uncertaintyReasons: [
                "timing_gap_detected",
                "segment_continuity_limited",
                "timing_or_segment_continuity_limitation",
                "low_or_insufficient_signal_quality",
                "suppressed_missing_data",
            ],
        },
    },
    {
        name: "device reset",
        scenarioId: "device_reset_or_timing_gap",
        windowStatus: "ready",
        featureSuppressionState: "suppressed_missing_baseline",
        ml: {
            predictedClass: "elevated_arousal_evidence",
            probability: 0.72,
            confidenceLabel: "moderate_confidence",
            suppressionState: "not_suppressed",
            uncertaintyReasons: ["source_bound_simulator_context"],
        },
        quality: baseQuality({
            segment_continuity_state: "device_boot_change",
        }),
        missingness: baseMissingness(),
        modalityAvailability: baseModalityAvailability(),
        features: baseFeatures(),
        baselineRelative: baseBaselineRelative({
            baseline_state: "unavailable",
            readiness_confidence_modifier: 0.5,
        }),
        crossSignal: {
            signal_conflict_score: 0.1,
            high_motion_confound_present: false,
            motion_confound_index: 0.1,
        },
        uncertaintyReasons: ["device_boot_change", "baseline_context_limited"],
        expected: {
            interpretationLabel: "insufficient_reliable_data",
            suppressionState: "suppressed_missing_baseline",
            confidenceLabel: "low_confidence",
            uncertaintyReasons: [
                "device_boot_change",
                "baseline_context_limited",
                "baseline_not_available",
                "suppressed_missing_baseline",
            ],
        },
    },
    {
        name: "ML unavailable",
        scenarioId: "elevated_arousal_pattern",
        windowStatus: "ready",
        featureSuppressionState: "not_suppressed",
        ml: "unavailable",
        quality: baseQuality(),
        missingness: baseMissingness(),
        modalityAvailability: baseModalityAvailability(),
        features: baseFeatures(),
        baselineRelative: baseBaselineRelative(),
        crossSignal: {
            signal_conflict_score: 0.1,
            high_motion_confound_present: false,
            motion_confound_index: 0.1,
        },
        uncertaintyReasons: ["model_availability_limited"],
        expected: {
            interpretationLabel: "insufficient_reliable_data",
            suppressionState: "suppressed_missing_data",
            confidenceLabel: "insufficient_confidence",
            uncertaintyReasons: [
                "model_availability_limited",
                "ml_inference_unavailable",
                "model_artifact_unavailable",
                "suppressed_missing_data",
            ],
        },
    },
];

describe("Stage 13 degraded simulator-to-dashboard E2E", () => {
    it.each(degradedCases)(
        "keeps $name scenario clinician-safe and uncertainty-bound",
        async (scenario) => {
            const assignments = makeAssignmentLookup();
            const sessions = new InMemoryObjectiveSessionRepository(fixedNow);
            const rawIngestion = new InMemoryObjectiveRawIngestionRepository(
                fixedNow,
            );
            const segmentManager = new InMemoryObjectiveSegmentManager(fixedNow);
            const featureWindows = new InMemoryObjectiveFeatureWindowRepository(
                fixedNow,
            );
            const mlInferences = new InMemoryObjectiveMlInferenceRepository(
                fixedNow,
            );
            const interpretations = new InMemoryObjectiveInterpretationRepository(
                fixedNow,
            );

            const createSessionResult = await createObjectiveSession(
                serviceActor,
                {
                    patient_id: PATIENT_ID,
                    source_type: "simulator",
                    device_id: DEVICE_ID,
                    device_boot_id: `${DEVICE_BOOT_ID}-${scenario.name
                        .toLowerCase()
                        .replaceAll(" ", "-")}`,
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
                throw new Error(`Expected session creation for ${scenario.name}`);
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
                scenario_id: scenario.scenarioId,
                seed: 62,
                duration_ms: 60_000,
            });

            expect(timeline.scenario_id).toBe(scenario.scenarioId);

            const simulatorBatch = generateObjectiveRawBatch({
                batch_id: `stage13-degraded-${scenario.name
                    .toLowerCase()
                    .replaceAll(" ", "-")}`,
                timeline,
                session_id: session.session_id,
                device_id: DEVICE_ID,
                device_boot_id: session.device_boot_id ?? DEVICE_BOOT_ID,
                sample_interval_ms: 1_000,
            });

            expect(simulatorBatch.source_type).toBe("simulator");
            expect(simulatorBatch.frames.length).toBeGreaterThan(0);

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
                throw new Error(`Expected ingestion to succeed for ${scenario.name}`);
            }

            expect(ingestResult.value.accepted_frame_count).toBeGreaterThan(0);

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

            const [foundation] = buildObjectiveFeatureWindows({
                batches: [preprocessingBatch],
                window_duration_ms: 30_000,
                step_ms: 30_000,
                expected_sample_interval_ms: 1_000,
                min_frames_per_window: 5,
            });

            expect(foundation).toBeDefined();

            const rawTraceability =
                await rawIngestion.listClinicianSafeChunkTraceability(
                    session.session_id,
                );

            expect(rawTraceability.length).toBeGreaterThan(0);
            expectNoUnsafeClinicianSurface(rawTraceability);

            const rawChunkRefs = rawTraceability.map((chunk) => chunk.raw_chunk_id);

            const [featureWindow] = await featureWindows.saveFeatureWindows([
                makeFeaturePersistenceInput(foundation, rawChunkRefs, scenario),
            ]);

            expectClinicianOnlyVisibility(featureWindow);

            const request = createObjectiveMlInferenceRequestFromFeatureWindow(
                featureWindow,
                {
                    request_id: `stage13-degraded:${featureWindow.feature_window_key}`,
                    timeout_ms: 1_000,
                },
            );

            expect(request.target).toBe(OBJECTIVE_ML_ALLOWED_TARGET);

            const savedMlInference =
                scenario.ml === "unavailable"
                    ? undefined
                    : await mlInferences.saveMlInference(
                          createObjectiveMlInferencePersistenceInput({
                              feature_window_id: featureWindow.id,
                              feature_window_key: featureWindow.feature_window_key,
                              session_id: featureWindow.session_id,
                              ...(featureWindow.segment_id
                                  ? { segment_id: featureWindow.segment_id }
                                  : {}),
                              response: validateObjectiveMlInferenceResponse({
                                  target: OBJECTIVE_ML_ALLOWED_TARGET,
                                  predicted_class: scenario.ml.predictedClass,
                                  confidence_label: scenario.ml.confidenceLabel,
                                  probability: scenario.ml.probability,
                                  uncertainty_reasons:
                                      scenario.ml.uncertaintyReasons,
                                  suppression_state: scenario.ml.suppressionState,
                                  model_version:
                                      "objective-ml-bounded-degraded-e2e-v1",
                                  visibility: {
                                      clinician_visible: true,
                                      patient_visible: false,
                                      chatbot_visible: false,
                                  },
                              }),
                              request_metadata: {
                                  request_id: request.request_id,
                              },
                          }),
                      );

            if (savedMlInference) {
                expectClinicianOnlyVisibility(savedMlInference);
            }

            const decision = mapObjectiveInterpretation({
                feature_window: toMapperFeatureWindow(featureWindow, scenario),
                ml_inference: savedMlInference
                    ? {
                          ml_inference_id: savedMlInference.id,
                          model_version: savedMlInference.model_version,
                          target: savedMlInference.target,
                          predicted_class: savedMlInference.predicted_class,
                          confidence_label: savedMlInference.confidence_label,
                          probability: savedMlInference.probability,
                          uncertainty_reasons: savedMlInference.uncertainty_reasons,
                          suppression_state: savedMlInference.suppression_state,
                          visibility: {
                              clinician_visible: true,
                              patient_visible: false,
                              chatbot_visible: false,
                          },
                      }
                    : undefined,
                artifact_state: {
                    source_banner: "simulated_data",
                    model_loaded: scenario.ml !== "unavailable",
                    ...(savedMlInference
                        ? { model_version: savedMlInference.model_version }
                        : {}),
                    preprocessing_version: featureWindow.preprocessing_version,
                    feature_schema_version: featureWindow.feature_schema_version,
                },
            });

            expectNestedClinicianOnlyVisibility(decision);
            expect(decision.source_banner).toBe("simulated_data");
            expect(decision.interpretation_label).toBe(
                scenario.expected.interpretationLabel,
            );
            expect(decision.suppression_state).toBe(
                scenario.expected.suppressionState,
            );
            expect(decision.confidence_label).toBe(
                scenario.expected.confidenceLabel,
            );
            expect(decision.evidence_level).toBe("none");
            expect(decision.uncertainty_reasons).toEqual(
                expect.arrayContaining(scenario.expected.uncertaintyReasons),
            );

            if (scenario.expected.excludedModalities) {
                expect(decision.excluded_modalities).toEqual(
                    expect.arrayContaining(scenario.expected.excludedModalities),
                );
            }

            const savedInterpretation = await interpretations.saveInterpretation(
                createObjectiveInterpretationPersistenceInput({
                    decision: decision as unknown as JsonObject,
                }),
            );

            expectClinicianOnlyVisibility(savedInterpretation);

            const streamEvent = serializeObjectiveClinicianStreamEvent(
                createObjectiveInterpretationRecordStreamEvent(savedInterpretation),
            );

            expect(streamEvent.visibility).toEqual({
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
                throw new Error(`Expected replay for ${scenario.name}`);
            }

            expect(replay.replay_banner).toBe("historical_non_live_replay");
            expect(replay.source_banner).toBe("simulated_data");
            expect(replay.interpretation_timeline).toHaveLength(1);

            const summary = await buildObjectiveFinalSessionSummary(
                makeSummaryRepository(
                    sessions,
                    featureWindows,
                    interpretations,
                    mlInferences,
                ),
                session.session_id,
                fixedNow,
            );

            expect(summary).not.toBeNull();
            if (!summary) {
                throw new Error(`Expected summary for ${scenario.name}`);
            }

            expect(summary.visibility).toEqual({
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            });
            expect(summary.total_windows).toBe(1);
            expect(summary.suppressed_fraction.fraction).toBe(
                scenario.featureSuppressionState === "not_suppressed" ? 0 : 1,
            );

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

            expectNoUnsafeClinicianSurface({
                rawTraceability,
                featureWindow,
                savedMlInference,
                savedInterpretation,
                streamEvent,
                replay,
                summary,
            });
        },
    );
});
