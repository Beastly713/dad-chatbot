import {
    OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
    type ObjectiveRawBatchInput,
} from "./rawIngestion.js";

export const OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE =
    "prototype_hardware" as const;

export const OBJECTIVE_PROTOTYPE_HARDWARE_BRIDGE_SCHEMA_VERSION =
    "objective-prototype-hardware-bridge-v1" as const;

export const OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV =
    "OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED" as const;

export type ObjectivePrototypeHardwareBridgeRole =
    | "developer"
    | "service"
    | "clinician"
    | "patient"
    | "chatbot";

export type ObjectivePrototypeHardwareVisibility = {
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
};

export type ObjectivePrototypeHardwareSensorStack = {
    microcontroller: "ESP32 VROOM-32";
    cardiac_frontend: "AD8232 ECG frontend";
    electrodermal_activity: "ProtoCentral TinyGSR";
    photoplethysmography: "MAX30101";
    motion_context: "MPU6050";
    local_temperature: "TMP117";
};

export type ObjectivePrototypeHardwareBridgeConfig = {
    schema_version: typeof OBJECTIVE_PROTOTYPE_HARDWARE_BRIDGE_SCHEMA_VERSION;
    source_type: typeof OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE;
    feature_flag: typeof OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV;
    enabled: boolean;
    default_enabled: false;
    serial_transport_enabled: false;
    bluetooth_transport_enabled: false;
    network_bridge_enabled: false;
    source_banner: string;
    visibility: ObjectivePrototypeHardwareVisibility;
};

export type ObjectivePrototypeHardwareMetadata = {
    schema_version: typeof OBJECTIVE_PROTOTYPE_HARDWARE_BRIDGE_SCHEMA_VERSION;
    source_type: typeof OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE;
    bridge_key: "prototype-hardware-bridge-disabled-v1";
    device_profile_key: "esp32-multisignal-prototype-v1";
    firmware_version?: string;
    hardware_revision?: string;
    sensor_stack: ObjectivePrototypeHardwareSensorStack;
    source_banner: string;
    prototype_only: true;
    engineering_only: true;
    live_ingestion_enabled: false;
    serial_transport_enabled: false;
    bluetooth_transport_enabled: false;
    network_bridge_enabled: false;
    clinical_validation_claim: false;
    validated_hardware_claim: false;
};

export type ObjectivePrototypeHardwareRawBatchTemplate = Omit<
    ObjectiveRawBatchInput,
    "source_type" | "schema_version" | "frames"
> & {
    source_type: typeof OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE;
    schema_version: typeof OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION;
    frames: [];
};

export type ObjectivePrototypeHardwareRawBatchContract = {
    schema_version: typeof OBJECTIVE_PROTOTYPE_HARDWARE_BRIDGE_SCHEMA_VERSION;
    source_type: typeof OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE;
    bridge_config: ObjectivePrototypeHardwareBridgeConfig;
    hardware_metadata: ObjectivePrototypeHardwareMetadata;
    raw_batch_contract: ObjectivePrototypeHardwareRawBatchTemplate;
    visibility: ObjectivePrototypeHardwareVisibility;
};

export type ObjectivePrototypeHardwareAccess =
    | {
          allowed: true;
          role: "developer" | "service";
      }
    | {
          allowed: false;
          code:
              | "objective_prototype_hardware_disabled"
              | "objective_prototype_hardware_patient_denied"
              | "objective_prototype_hardware_chatbot_denied"
              | "objective_prototype_hardware_role_required";
          message: string;
      };

export type ObjectivePrototypeHardwareRawBatchContractInput = {
    batchId: string;
    sessionId: string;
    deviceId: string;
    deviceBootId: string;
    segmentId?: string;
    firmwareVersion?: string;
    hardwareRevision?: string;
};

function assertNonEmptyString(value: string, name: string): string {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
        throw new Error(`${name} must be a non-empty string`);
    }

    return trimmed;
}

function isTruthyFeatureFlag(value: string | undefined): boolean {
    const normalized = value?.trim().toLowerCase();

    return (
        normalized === "true" ||
        normalized === "1" ||
        normalized === "enabled" ||
        normalized === "debug"
    );
}

function visibility(): ObjectivePrototypeHardwareVisibility {
    return {
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    };
}

export function createObjectivePrototypeHardwareSourceBanner(): string {
    return [
        "Prototype hardware bridge skeleton for engineering contract checks only.",
        "Live ESP32 ingestion is disabled by default.",
        "This project makes no device-readiness, care-use, or clinical decision claim.",
    ].join(" ");
}

export function createObjectivePrototypeHardwareSensorStack(): ObjectivePrototypeHardwareSensorStack {
    return {
        microcontroller: "ESP32 VROOM-32",
        cardiac_frontend: "AD8232 ECG frontend",
        electrodermal_activity: "ProtoCentral TinyGSR",
        photoplethysmography: "MAX30101",
        motion_context: "MPU6050",
        local_temperature: "TMP117",
    };
}

export function resolveObjectivePrototypeHardwareBridgeConfig(
    env: Record<string, string | undefined> = process.env,
): ObjectivePrototypeHardwareBridgeConfig {
    return {
        schema_version: OBJECTIVE_PROTOTYPE_HARDWARE_BRIDGE_SCHEMA_VERSION,
        source_type: OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE,
        feature_flag: OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV,
        enabled: isTruthyFeatureFlag(
            env[OBJECTIVE_PROTOTYPE_HARDWARE_INGESTION_ENABLED_ENV],
        ),
        default_enabled: false,
        serial_transport_enabled: false,
        bluetooth_transport_enabled: false,
        network_bridge_enabled: false,
        source_banner: createObjectivePrototypeHardwareSourceBanner(),
        visibility: visibility(),
    };
}

export function createObjectivePrototypeHardwareMetadata(
    input: {
        firmwareVersion?: string;
        hardwareRevision?: string;
    } = {},
): ObjectivePrototypeHardwareMetadata {
    return {
        schema_version: OBJECTIVE_PROTOTYPE_HARDWARE_BRIDGE_SCHEMA_VERSION,
        source_type: OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE,
        bridge_key: "prototype-hardware-bridge-disabled-v1",
        device_profile_key: "esp32-multisignal-prototype-v1",
        firmware_version:
            input.firmwareVersion !== undefined
                ? assertNonEmptyString(input.firmwareVersion, "firmwareVersion")
                : undefined,
        hardware_revision:
            input.hardwareRevision !== undefined
                ? assertNonEmptyString(input.hardwareRevision, "hardwareRevision")
                : undefined,
        sensor_stack: createObjectivePrototypeHardwareSensorStack(),
        source_banner: createObjectivePrototypeHardwareSourceBanner(),
        prototype_only: true,
        engineering_only: true,
        live_ingestion_enabled: false,
        serial_transport_enabled: false,
        bluetooth_transport_enabled: false,
        network_bridge_enabled: false,
        clinical_validation_claim: false,
        validated_hardware_claim: false,
    };
}

export function resolveObjectivePrototypeHardwareBridgeAccess(input: {
    role?: ObjectivePrototypeHardwareBridgeRole | string | null;
    enabled?: boolean;
}): ObjectivePrototypeHardwareAccess {
    if (!input.enabled) {
        return {
            allowed: false,
            code: "objective_prototype_hardware_disabled",
            message:
                "Prototype hardware ingestion is disabled by default and requires an explicit server-side debug flag.",
        };
    }

    if (input.role === "patient") {
        return {
            allowed: false,
            code: "objective_prototype_hardware_patient_denied",
            message: "Prototype hardware ingestion is not available to patients.",
        };
    }

    if (input.role === "chatbot") {
        return {
            allowed: false,
            code: "objective_prototype_hardware_chatbot_denied",
            message: "Prototype hardware ingestion is not available to chatbot flows.",
        };
    }

    if (input.role === "developer" || input.role === "service") {
        return {
            allowed: true,
            role: input.role,
        };
    }

    return {
        allowed: false,
        code: "objective_prototype_hardware_role_required",
        message:
            "Prototype hardware ingestion requires a developer or service actor when explicitly enabled.",
    };
}

export function createObjectivePrototypeHardwareRawBatchContract(
    input: ObjectivePrototypeHardwareRawBatchContractInput,
    env: Record<string, string | undefined> = {},
): ObjectivePrototypeHardwareRawBatchContract {
    const batchId = assertNonEmptyString(input.batchId, "batchId");
    const sessionId = assertNonEmptyString(input.sessionId, "sessionId");
    const deviceId = assertNonEmptyString(input.deviceId, "deviceId");
    const deviceBootId = assertNonEmptyString(input.deviceBootId, "deviceBootId");

    const rawBatchContract: ObjectivePrototypeHardwareRawBatchTemplate = {
        batch_id: batchId,
        session_id: sessionId,
        source_type: OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE,
        schema_version: OBJECTIVE_RAW_SENSOR_SCHEMA_VERSION,
        device_id: deviceId,
        device_boot_id: deviceBootId,
        ...(input.segmentId
            ? {
                  segment_id: assertNonEmptyString(input.segmentId, "segmentId"),
              }
            : {}),
        frames: [],
    };

    return {
        schema_version: OBJECTIVE_PROTOTYPE_HARDWARE_BRIDGE_SCHEMA_VERSION,
        source_type: OBJECTIVE_PROTOTYPE_HARDWARE_SOURCE_TYPE,
        bridge_config: resolveObjectivePrototypeHardwareBridgeConfig(env),
        hardware_metadata: createObjectivePrototypeHardwareMetadata({
            firmwareVersion: input.firmwareVersion,
            hardwareRevision: input.hardwareRevision,
        }),
        raw_batch_contract: rawBatchContract,
        visibility: visibility(),
    };
}
