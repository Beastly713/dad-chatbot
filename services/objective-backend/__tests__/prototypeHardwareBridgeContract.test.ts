import {
    FORBIDDEN_OBJECTIVE_FIELD_NAMES,
    FORBIDDEN_OBJECTIVE_LABELS,
    FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
    findForbiddenObjectiveTermViolations,
} from "@dad-chatbot/objective-safety";
import {
    OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV,
    OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE,
    createObjectivePrototypeHardwareMetadata,
    createObjectivePrototypeHardwareRawBatchContract,
    createObjectivePrototypeHardwareSensorStack,
    createObjectivePrototypeHardwareSourceBanner,
    resolveObjectivePrototypeHardwareBridgeAccess,
    resolveObjectivePrototypeHardwareBridgeConfig,
} from "../src/prototypeHardwareBridge.js";
import { OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION } from "../src/rawIngestion.js";

function expectClinicianOnlyVisibility(value: {
    clinician_visible: boolean;
    patient_visible: boolean;
    chatbot_visible: boolean;
}): void {
    expect(value).toEqual({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    });
}

function expectNoForbiddenObjectiveTerms(value: unknown): void {
    const serialized = JSON.stringify(value);

    for (const forbidden of [
        ...FORBIDDEN_OBJECTIVE_LABELS,
        ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
        ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
    ]) {
        expect(serialized).not.toContain(forbidden);
    }

    expect(serialized.toLowerCase()).not.toContain("risk score");
    expect(serialized.toLowerCase()).not.toContain("clinical alert");
    expect(serialized.toLowerCase()).not.toContain("emergency alert");
    expect(serialized.toLowerCase()).not.toContain("medical device");
    expect(serialized.toLowerCase()).not.toContain("care device");
    expect(serialized.toLowerCase()).not.toContain("diagnostic");
    expect(serialized.toLowerCase()).not.toContain("ground_truth");

    const violations = findForbiddenObjectiveTermViolations([
        {
            path: "services/objective-backend/src/prototypeHardwareBridge.ts",
            surface: "source",
            content: serialized,
        },
    ]);

    expect(violations).toEqual([]);
}

describe("prototype hardware bridge contract", () => {
    it("declares prototype hardware source type and disabled-by-default feature flag", () => {
        expect(OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE).toBe(
            "prototype_hardware",
        );
        expect(OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV).toBe(
            "OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED",
        );

        const config = resolveObjectivePrototypeHardwareBridgeConfig({});

        expect(config).toEqual(
            expect.objectContaining({
                schema_version: "objective-prototype-hardware-bridge-v1",
                source_type: "prototype_hardware",
                feature_flag: "OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED",
                enabled: false,
                default_enabled: false,
                serial_transport_enabled: false,
                bluetooth_transport_enabled: false,
                network_bridge_enabled: false,
            }),
        );
        expectClinicianOnlyVisibility(config.visibility);
        expectNoForbiddenObjectiveTerms(config);
    });

    it("requires an explicit server-side debug flag before developer or service access is allowed", () => {
        expect(
            resolveObjectivePrototypeHardwareBridgeConfig({
                OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED: "true",
            }).enabled,
        ).toBe(true);

        expect(
            resolveObjectivePrototypeHardwareBridgeAccess({
                role: "service",
                enabled: false,
            }),
        ).toEqual({
            allowed: false,
            code: "objective_prototype_hardware_disabled",
            message:
                "Prototype hardware ingestion is disabled by default and requires an explicit server-side debug flag.",
        });

        expect(
            resolveObjectivePrototypeHardwareBridgeAccess({
                role: "developer",
                enabled: true,
            }),
        ).toEqual({
            allowed: true,
            role: "developer",
        });

        expect(
            resolveObjectivePrototypeHardwareBridgeAccess({
                role: "service",
                enabled: true,
            }),
        ).toEqual({
            allowed: true,
            role: "service",
        });
    });

    it("denies patient, chatbot, clinician, and missing roles when explicitly enabled", () => {
        expect(
            resolveObjectivePrototypeHardwareBridgeAccess({
                role: "patient",
                enabled: true,
            }),
        ).toEqual({
            allowed: false,
            code: "objective_prototype_hardware_patient_denied",
            message: "Prototype hardware ingestion is not available to patients.",
        });

        expect(
            resolveObjectivePrototypeHardwareBridgeAccess({
                role: "chatbot",
                enabled: true,
            }),
        ).toEqual({
            allowed: false,
            code: "objective_prototype_hardware_chatbot_denied",
            message: "Prototype hardware ingestion is not available to chatbot flows.",
        });

        for (const role of ["clinician", undefined] as const) {
            expect(
                resolveObjectivePrototypeHardwareBridgeAccess({
                    role,
                    enabled: true,
                }),
            ).toEqual({
                allowed: false,
                code: "objective_prototype_hardware_role_required",
                message:
                    "Prototype hardware ingestion requires a developer or service actor when explicitly enabled.",
            });
        }
    });

    it("describes the intended prototype sensor stack without device-readiness claims", () => {
        const sensorStack = createObjectivePrototypeHardwareSensorStack();

        expect(sensorStack).toEqual({
            microcontroller: "ESP32 VROOM-32",
            cardiac_frontend: "AD8232 ECG frontend",
            electrodermal_activity: "ProtoCentral TinyGSR",
            photoplethysmography: "MAX30101",
            motion_context: "MPU6050",
            local_temperature: "TMP117",
        });

        const banner = createObjectivePrototypeHardwareSourceBanner();

        expect(banner).toContain("Prototype hardware bridge skeleton");
        expect(banner).toContain("engineering contract checks only");
        expect(banner).toContain("disabled by default");
        expect(banner).toContain(
            "no device-readiness, care-use, or clinical decision claim",
        );
        expectNoForbiddenObjectiveTerms({ sensorStack, banner });
    });

    it("creates hardware metadata with clinician-only visibility and no enabled transport", () => {
        const metadata = createObjectivePrototypeHardwareMetadata({
            firmwareVersion: "esp32-prototype-fw-local",
            hardwareRevision: "bench-revision-a",
        });

        expect(metadata).toEqual(
            expect.objectContaining({
                schema_version: "objective-prototype-hardware-bridge-v1",
                source_type: "prototype_hardware",
                bridge_key: "prototype-hardware-bridge-disabled-v1",
                device_profile_key: "esp32-multisignal-prototype-v1",
                firmware_version: "esp32-prototype-fw-local",
                hardware_revision: "bench-revision-a",
                prototype_only: true,
                engineering_only: true,
                live_ingestion_enabled: false,
                serial_transport_enabled: false,
                bluetooth_transport_enabled: false,
                network_bridge_enabled: false,
                clinical_validation_claim: false,
                validated_hardware_claim: false,
            }),
        );
        expect(metadata.sensor_stack.microcontroller).toBe("ESP32 VROOM-32");
        expectNoForbiddenObjectiveTerms(metadata);
    });

    it("creates a disabled raw batch contract using the same raw batch envelope shape", () => {
        const contract = createObjectivePrototypeHardwareRawBatchContract(
            {
                batchId: "hardware-batch-1",
                sessionId: "hardware-session-1",
                deviceId: "esp32-device-1",
                deviceBootId: "esp32-boot-1",
                segmentId: "segment-1",
                firmwareVersion: "esp32-prototype-fw-local",
                hardwareRevision: "bench-revision-a",
            },
            {},
        );

        expect(contract).toEqual(
            expect.objectContaining({
                schema_version: "objective-prototype-hardware-bridge-v1",
                source_type: "prototype_hardware",
            }),
        );
        expectClinicianOnlyVisibility(contract.visibility);

        expect(contract.bridge_config.enabled).toBe(false);
        expect(contract.hardware_metadata.live_ingestion_enabled).toBe(false);

        expect(contract.raw_batch_contract).toEqual({
            batch_id: "hardware-batch-1",
            session_id: "hardware-session-1",
            source_type: "prototype_hardware",
            schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
            device_id: "esp32-device-1",
            device_boot_id: "esp32-boot-1",
            segment_id: "segment-1",
            frames: [],
        });

        expect(Object.keys(contract.raw_batch_contract).sort()).toEqual([
            "batch_id",
            "device_boot_id",
            "device_id",
            "frames",
            "schema_version",
            "segment_id",
            "session_id",
            "source_type",
        ]);
        expectNoForbiddenObjectiveTerms(contract);
    });

    it("rejects empty bridge contract identifiers before producing a payload", () => {
        expect(() =>
            createObjectivePrototypeHardwareRawBatchContract({
                batchId: "",
                sessionId: "hardware-session-1",
                deviceId: "esp32-device-1",
                deviceBootId: "esp32-boot-1",
            }),
        ).toThrow("batchId must be a non-empty string");

        expect(() =>
            createObjectivePrototypeHardwareRawBatchContract({
                batchId: "hardware-batch-1",
                sessionId: "hardware-session-1",
                deviceId: "esp32-device-1",
                deviceBootId: "",
            }),
        ).toThrow("deviceBootId must be a non-empty string");
    });
});
