import { assertAllowedObjectiveSourceType } from "@dad-chatbot/objective-safety";

export const OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE =
  "public_dataset_replay" as const;

export const OBJECTIVE_PUBLIC_DATASET_REPLAY_SCHEMA_VERSION =
  "objective-public-dataset-replay-adapter-v1" as const;

export const OBJECTIVE_PUBLIC_DATASET_REPLAY_KEYS = [
  "wesad",
  "case",
  "ppg_dalia"
] as const;

export type ObjectivePublicDatasetReplayKey =
  (typeof OBJECTIVE_PUBLIC_DATASET_REPLAY_KEYS)[number];

export type ObjectivePublicDatasetReplayRole =
  | "developer"
  | "service"
  | "clinician"
  | "patient"
  | "chatbot";

export type ObjectivePublicDatasetReplayVisibility = {
  clinician_visible: true;
  patient_visible: false;
  chatbot_visible: false;
  developer_labels_visible: false;
};

export type ObjectivePublicDatasetReplayMetadata = {
  source_type: typeof OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE;
  dataset_key: ObjectivePublicDatasetReplayKey;
  source_banner: string;
  adapter_status: "skeleton_only";
  engineering_only: true;
  replay_preparation_only: true;
  local_dataset_required: true;
  local_dataset_available: false;
  dataset_files_bundled: false;
  automatic_download_enabled: false;
  network_fetch_enabled: false;
  clinical_validation_claim: false;
};

export type ObjectivePublicDatasetReplayProfile = {
  schema_version: typeof OBJECTIVE_PUBLIC_DATASET_REPLAY_SCHEMA_VERSION;
  dataset_key: ObjectivePublicDatasetReplayKey;
  display_name: string;
  description: string;
  source_type: typeof OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE;
  supported_signal_families: readonly string[];
  visibility: ObjectivePublicDatasetReplayVisibility;
  source_metadata: ObjectivePublicDatasetReplayMetadata;
};

export type ObjectivePublicDatasetReplayAccess =
  | {
      allowed: true;
      role: "developer" | "service";
    }
  | {
      allowed: false;
      code:
        | "objective_public_dataset_replay_role_required"
        | "objective_public_dataset_replay_patient_denied"
        | "objective_public_dataset_replay_chatbot_denied";
      message: string;
    };

export type ObjectivePublicDatasetReplayPlan = {
  schema_version: typeof OBJECTIVE_PUBLIC_DATASET_REPLAY_SCHEMA_VERSION;
  dataset_key: ObjectivePublicDatasetReplayKey;
  source_type: typeof OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE;
  prepared: false;
  reason: "local_dataset_adapter_not_implemented";
  generated_frame_count: 0;
  prepared_batch_count: 0;
  source_banner: string;
  visibility: ObjectivePublicDatasetReplayVisibility;
  source_metadata: ObjectivePublicDatasetReplayMetadata;
};

function visibility(): ObjectivePublicDatasetReplayVisibility {
  return {
    clinician_visible: true,
    patient_visible: false,
    chatbot_visible: false,
    developer_labels_visible: false
  };
}

function sourceBanner(displayName: string): string {
  return `${displayName} public dataset replay adapter skeleton for engineering replay preparation only. No dataset files are bundled, downloaded, or clinically validated by this project.`;
}

function makeProfile(
  dataset_key: ObjectivePublicDatasetReplayKey,
  display_name: string,
  description: string,
  supported_signal_families: readonly string[]
): ObjectivePublicDatasetReplayProfile {
  assertAllowedObjectiveSourceType(OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE);

  const banner = sourceBanner(display_name);

  return {
    schema_version: OBJECTIVE_PUBLIC_DATASET_REPLAY_SCHEMA_VERSION,
    dataset_key,
    display_name,
    description,
    source_type: OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE,
    supported_signal_families,
    visibility: visibility(),
    source_metadata: {
      source_type: OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE,
      dataset_key,
      source_banner: banner,
      adapter_status: "skeleton_only",
      engineering_only: true,
      replay_preparation_only: true,
      local_dataset_required: true,
      local_dataset_available: false,
      dataset_files_bundled: false,
      automatic_download_enabled: false,
      network_fetch_enabled: false,
      clinical_validation_claim: false
    }
  };
}

export const OBJECTIVE_PUBLIC_DATASET_REPLAY_PROFILES = {
  wesad: makeProfile(
    "wesad",
    "WESAD-style",
    "Public wearable dataset replay skeleton for future local adapter work.",
    ["cardiac_activity", "electrodermal_activity", "motion_context"]
  ),

  case: makeProfile(
    "case",
    "CASE-style",
    "Public affective-sensing dataset replay skeleton for future local adapter work.",
    ["cardiac_activity", "electrodermal_activity", "temperature_context"]
  ),

  ppg_dalia: makeProfile(
    "ppg_dalia",
    "PPG-DaLiA-style",
    "Public photoplethysmography dataset replay skeleton for future local adapter work.",
    ["photoplethysmography", "motion_context"]
  )
} satisfies Record<
  ObjectivePublicDatasetReplayKey,
  ObjectivePublicDatasetReplayProfile
>;

export function isObjectivePublicDatasetReplayKey(
  value: string
): value is ObjectivePublicDatasetReplayKey {
  return (OBJECTIVE_PUBLIC_DATASET_REPLAY_KEYS as readonly string[]).includes(
    value
  );
}

export function assertObjectivePublicDatasetReplayKey(
  value: string
): ObjectivePublicDatasetReplayKey {
  if (!isObjectivePublicDatasetReplayKey(value)) {
    throw new Error(`Unsupported objective public dataset replay key: ${value}`);
  }

  return value;
}

export function listObjectivePublicDatasetReplayProfiles(): ObjectivePublicDatasetReplayProfile[] {
  return OBJECTIVE_PUBLIC_DATASET_REPLAY_KEYS.map((datasetKey) => ({
    ...OBJECTIVE_PUBLIC_DATASET_REPLAY_PROFILES[datasetKey],
    visibility: visibility(),
    source_metadata: {
      ...OBJECTIVE_PUBLIC_DATASET_REPLAY_PROFILES[datasetKey].source_metadata
    }
  }));
}

export function getObjectivePublicDatasetReplayProfile(
  datasetKey: string
): ObjectivePublicDatasetReplayProfile {
  const safeDatasetKey = assertObjectivePublicDatasetReplayKey(datasetKey);
  const profile = OBJECTIVE_PUBLIC_DATASET_REPLAY_PROFILES[safeDatasetKey];

  return {
    ...profile,
    visibility: visibility(),
    source_metadata: {
      ...profile.source_metadata
    }
  };
}

export function resolveObjectivePublicDatasetReplayAccess(
  role: ObjectivePublicDatasetReplayRole | string | null | undefined
): ObjectivePublicDatasetReplayAccess {
  if (role === "patient") {
    return {
      allowed: false,
      code: "objective_public_dataset_replay_patient_denied",
      message: "Public dataset replay preparation is not available to patients."
    };
  }

  if (role === "chatbot") {
    return {
      allowed: false,
      code: "objective_public_dataset_replay_chatbot_denied",
      message: "Public dataset replay preparation is not available to chatbot flows."
    };
  }

  if (role === "developer" || role === "service") {
    return {
      allowed: true,
      role
    };
  }

  return {
    allowed: false,
    code: "objective_public_dataset_replay_role_required",
    message:
      "Public dataset replay preparation requires a developer or service actor."
  };
}

export function createObjectivePublicDatasetReplayPlan(
  datasetKey: string
): ObjectivePublicDatasetReplayPlan {
  const profile = getObjectivePublicDatasetReplayProfile(datasetKey);

  return {
    schema_version: OBJECTIVE_PUBLIC_DATASET_REPLAY_SCHEMA_VERSION,
    dataset_key: profile.dataset_key,
    source_type: OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE,
    prepared: false,
    reason: "local_dataset_adapter_not_implemented",
    generated_frame_count: 0,
    prepared_batch_count: 0,
    source_banner: profile.source_metadata.source_banner,
    visibility: visibility(),
    source_metadata: {
      ...profile.source_metadata
    }
  };
}
