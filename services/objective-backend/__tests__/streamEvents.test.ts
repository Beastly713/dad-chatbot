import type { ObjectiveFeatureWindowRecord } from "../src/featureStorage.js";
import type { ObjectiveMlInferenceRecord } from "../src/mlInferenceStorage.js";
import type { ObjectiveSessionRecord } from "../src/sessionLifecycle.js";
import {
    createObjectiveChartSamplesStreamEvent,
    createObjectiveFeatureWindowStreamEvent,
    createObjectiveHeartbeatStreamEvent,
    createObjectiveMlInferenceStreamEvent,
    createObjectiveSessionStatusStreamEvent,
    InMemoryObjectiveClinicianStreamHub,
    serializeObjectiveClinicianStreamEvent,
} from "../src/streamEvents.js";

function makeSession(): ObjectiveSessionRecord {
    return {
        session_id: "session-1",
        patient_id: "patient-1",
        source_type: "simulator",
        status: "active",
        device_id: "device-1",
        device_boot_id: "boot-1",
        created_at: "2026-06-02T10:00:00.000Z",
        started_at: "2026-06-02T10:00:01.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function makeFeatureWindow(): ObjectiveFeatureWindowRecord {
    return {
        id: "feature-window-id-1",
        feature_window_key: "feature-window-1",
        session_id: "session-1",
        segment_id: "segment-1",
        source_type: "simulator",
        start_esp_time_ms: 1000,
        end_esp_time_ms: 31_000,
        raw_chunk_refs: ["chunk-1"],
        raw_range_refs: { first_esp_time_ms: 1000, last_esp_time_ms: 31_000 },
        preprocessing_version: "objective-preprocessing-v1",
        feature_schema_version: "objective-feature-window-foundation-v1",
        window_status: "ready",
        suppression_state: "not_suppressed",
        quality: { ecg: 0.9, gsr: 0.8 },
        missingness: { ecg: 0, gsr: 0 },
        modality_availability: { ecg: true, gsr: true },
        features: { ecg_median_hr_delta_bpm: 12 },
        baseline_relative: { ecg_median_hr_delta_bpm: 12 },
        uncertainty_reasons: ["quality_usable"],
        created_at: "2026-06-02T10:00:31.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function makeMlInference(): ObjectiveMlInferenceRecord {
    return {
        id: "ml-inference-id-1",
        inference_key: "feature-window-id-1:objective-ml-classical-tabular-v1",
        feature_window_id: "feature-window-id-1",
        feature_window_key: "feature-window-1",
        session_id: "session-1",
        segment_id: "segment-1",
        model_version: "objective-ml-classical-tabular-v1",
        target: "baseline_relative_elevated_physiological_arousal_evidence",
        predicted_class: "elevated_arousal_evidence",
        confidence_label: "moderate_confidence",
        probability: 0.66,
        uncertainty_reasons: ["quality_usable"],
        suppression_state: "not_suppressed",
        inference_response: {
            model_version: "objective-ml-classical-tabular-v1",
            target: "baseline_relative_elevated_physiological_arousal_evidence",
            predicted_class: "elevated_arousal_evidence",
            confidence_label: "moderate_confidence",
            probability: 0.66,
            uncertainty_reasons: ["quality_usable"],
            suppression_state: "not_suppressed",
            visibility: {
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            },
        },
        created_at: "2026-06-02T10:00:32.000Z",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

function expectClinicianOnly(serialized: string): void {
    expect(serialized).toContain('"clinician_visible":true');
    expect(serialized).toContain('"patient_visible":false');
    expect(serialized).toContain('"chatbot_visible":false');
    expect(serialized).not.toContain('"patient_visible":true');
    expect(serialized).not.toContain('"chatbot_visible":true');
}

function expectNoRawOrForbidden(serialized: string): void {
    const lower = serialized.toLowerCase();

    for (const forbidden of [
        "raw_payload",
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
    ]) {
        expect(lower).not.toContain(forbidden);
    }
}

describe("objective clinician stream events", () => {
    it("creates clinician-only heartbeat and session status events", () => {
        const heartbeat = createObjectiveHeartbeatStreamEvent("session-1");
        const status = createObjectiveSessionStatusStreamEvent(makeSession());

        for (const event of [heartbeat, status]) {
            const serialized = JSON.stringify(event);
            expectClinicianOnly(serialized);
            expectNoRawOrForbidden(serialized);
            expect(event.session_id).toBe("session-1");
        }

        expect(heartbeat.event_type).toBe("heartbeat");
        expect(status.event_type).toBe("session.status");
    });

    it("serializes chart samples without raw sensor field names", () => {
        const event = createObjectiveChartSamplesStreamEvent("session-1", [
            {
                t_ms: 1000,
                relative_time_ms: 0,
                values: {
                    heart_activity_trend: 0.3,
                    skin_conductance_trend: 0.2,
                    ppg_pulse_trend: 0.25,
                    motion_confound_index: 0.1,
                    local_temperature_trend: 0.05,
                },
                quality: {
                    overall: "usable",
                },
            },
        ]);

        const serialized = JSON.stringify(event);
        expect(event.event_type).toBe("chart.samples");
        expect(serialized).toContain("heart_activity_trend");
        expect(serialized).toContain("skin_conductance_trend");
        expectNoRawOrForbidden(serialized);
        expectClinicianOnly(serialized);
    });

    it("serializes feature and ML events through safe payloads only", () => {
        const featureEvent = createObjectiveFeatureWindowStreamEvent(
            makeFeatureWindow(),
        );
        const mlEvent = createObjectiveMlInferenceStreamEvent(makeMlInference());

        expect(featureEvent.event_type).toBe("feature.window");
        expect(mlEvent.event_type).toBe("ml.inference");

        for (const event of [featureEvent, mlEvent]) {
            const serialized = JSON.stringify(event);
            expectNoRawOrForbidden(serialized);
            expectClinicianOnly(serialized);
        }

        expect(JSON.stringify(featureEvent)).not.toContain('"features"');
        expect(JSON.stringify(mlEvent)).not.toContain("inference_response");
    });

    it("rejects unsafe stream payload fields", () => {
        expect(() =>
            serializeObjectiveClinicianStreamEvent({
                event_id: "event-1",
                event_type: "quality.update",
                session_id: "session-1",
                emitted_at: "2026-06-02T10:00:00.000Z",
                payload: {
                    ecg_raw: 2900,
                },
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            }),
        ).toThrow("Unsafe stream payload key");
    });

    it("rejects non-clinician visibility inside nested payloads", () => {
        expect(() =>
            serializeObjectiveClinicianStreamEvent({
                event_id: "event-1",
                event_type: "quality.update",
                session_id: "session-1",
                emitted_at: "2026-06-02T10:00:00.000Z",
                payload: {
                    nested: {
                        clinician_visible: true,
                        patient_visible: true,
                        chatbot_visible: false,
                    },
                },
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            }),
        ).toThrow("clinician-only");
    });

    it("publishes only to matching session subscribers with allowed scopes", () => {
        const hub = new InMemoryObjectiveClinicianStreamHub();
        const delivered: string[] = [];

        hub.subscribe("session-1", {
            allowedScopes: new Set(["heartbeat", "feature.window"]),
            send(event) {
                delivered.push(event.event_type);
            },
        });

        hub.subscribe("session-2", {
            allowedScopes: new Set(["heartbeat", "feature.window"]),
            send(event) {
                delivered.push(`wrong:${event.event_type}`);
            },
        });

        expect(hub.publish(createObjectiveHeartbeatStreamEvent("session-1"))).toBe(
            1,
        );
        expect(
            hub.publish(
                createObjectiveChartSamplesStreamEvent("session-1", [
                    {
                        t_ms: 1000,
                        values: {
                            heart_activity_trend: 0.1,
                        },
                    },
                ]),
            ),
        ).toBe(0);

        expect(delivered).toEqual(["heartbeat"]);
    });
});
