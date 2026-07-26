export const OBJECTIVE_DEV_SIMULATOR_ROUTE = "/dev/objective-simulator";
export const OBJECTIVE_DEV_SIMULATOR_ENABLE_ENV =
  "OBJECTIVE_DEV_SIMULATOR_ENABLED";
export const OBJECTIVE_DEV_SIMULATOR_ROLE_ENV =
  "OBJECTIVE_DEV_SIMULATOR_ROLE";

export type ObjectiveDevSimulatorRole =
  | "developer"
  | "clinician"
  | "service"
  | "patient"
  | "chatbot";

export type ObjectiveDevSimulatorAccessInput = {
  enabledFlag?: string | null;
  role?: string | null;
};

export type ObjectiveDevSimulatorAccess =
  | {
      allowed: true;
      mode: "developer_debug";
      banner: string;
    }
  | {
      allowed: false;
      code:
        | "objective_dev_simulator_disabled"
        | "objective_dev_simulator_developer_required";
      banner: string;
    };

export type ObjectiveDevSimulatorScenario = {
  id:
    | "baseline_rest"
    | "elevated_arousal_pattern"
    | "recovery_cooldown"
    | "motion_artifact"
    | "poor_contact"
    | "sensor_dropout"
    | "signal_conflict"
    | "device_reset_or_timing_gap";
  label: string;
  description: string;
};

export type ObjectiveDevSimulatorControl = {
  id: string;
  label: string;
  description: string;
};

export type ObjectiveDevOnlyLabel = {
  id: string;
  label: string;
  value: string;
};

export const OBJECTIVE_DEV_SIMULATOR_SCENARIOS: ObjectiveDevSimulatorScenario[] = [
  {
    id: "baseline_rest",
    label: "Baseline rest",
    description: "Stable baseline-oriented simulator profile for engineering checks.",
  },
  {
    id: "elevated_arousal_pattern",
    label: "Elevated arousal pattern",
    description:
      "Baseline-relative elevated physiological arousal evidence pattern for engineering checks.",
  },
  {
    id: "recovery_cooldown",
    label: "Recovery cooldown",
    description:
      "Simulator profile that moves from elevated arousal evidence toward a cooldown pattern.",
  },
  {
    id: "motion_artifact",
    label: "Motion artifact",
    description: "Movement and activity-like confound coverage.",
  },
  {
    id: "poor_contact",
    label: "Poor contact",
    description: "Signal-quality limitation coverage.",
  },
  {
    id: "sensor_dropout",
    label: "Sensor dropout",
    description: "Missingness and dropout coverage.",
  },
  {
    id: "signal_conflict",
    label: "Signal conflict",
    description: "Cross-signal disagreement coverage.",
  },
  {
    id: "device_reset_or_timing_gap",
    label: "Device reset or timing gap",
    description: "Timing discontinuity and device reset coverage.",
  },
];

export const OBJECTIVE_DEV_SIMULATOR_CONTROLS: ObjectiveDevSimulatorControl[] = [
  {
    id: "choose_scenario",
    label: "Choose scenario",
    description: "Select a deterministic simulator profile.",
  },
  {
    id: "choose_seed",
    label: "Choose seed",
    description: "Set a deterministic seed for repeatable engineering checks.",
  },
  {
    id: "start_stream",
    label: "Start stream",
    description: "Prepare a local simulator stream plan.",
  },
  {
    id: "stop_stream",
    label: "Stop stream",
    description: "Stop the local simulator stream plan.",
  },
  {
    id: "inject_artifact",
    label: "Inject artifact",
    description: "Add an engineering artifact scenario for validation.",
  },
  {
    id: "view_developer_only_labels",
    label: "View developer-only labels",
    description: "Show local debug labels that are not clinician or patient output.",
  },
];

export const OBJECTIVE_DEV_ONLY_LABELS: ObjectiveDevOnlyLabel[] = [
  {
    id: "timeline_phase_labels",
    label: "Timeline phase labels",
    value:
      "baseline period, elevated arousal period, recovery period, movement confound period, quality limitation period",
  },
  {
    id: "injection_coverage_labels",
    label: "Injection coverage labels",
    value:
      "motion artifact, poor contact, sensor dropout, signal conflict, timing gap, device reset",
  },
  {
    id: "source_banner",
    label: "Engineering source banner",
    value: "Synthetic simulator data for engineering and safety testing only.",
  },
];

function isTruthyDevFlag(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();

  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "enabled" ||
    normalized === "debug"
  );
}

function isDeveloperRole(value: string | null | undefined): boolean {
  return value === "developer";
}

export function resolveObjectiveDevSimulatorAccess(
  input: ObjectiveDevSimulatorAccessInput,
): ObjectiveDevSimulatorAccess {
  if (!isTruthyDevFlag(input.enabledFlag)) {
    return {
      allowed: false,
      code: "objective_dev_simulator_disabled",
      banner:
        "Developer objective simulator is disabled. Set OBJECTIVE_DEV_SIMULATOR_ENABLED=true in a local debug environment.",
    };
  }

  if (!isDeveloperRole(input.role)) {
    return {
      allowed: false,
      code: "objective_dev_simulator_developer_required",
      banner:
        "Developer objective simulator requires a developer/debug role. Patient, chatbot, clinician, and service modes are not allowed here.",
    };
  }

  return {
    allowed: true,
    mode: "developer_debug",
    banner:
      "Developer objective simulator is enabled for local engineering checks only.",
  };
}

export function resolveObjectiveDevSimulatorAccessFromEnv(
  env: Record<string, string | undefined> = process.env,
): ObjectiveDevSimulatorAccess {
  return resolveObjectiveDevSimulatorAccess({
    enabledFlag: env[OBJECTIVE_DEV_SIMULATOR_ENABLE_ENV],
    role: env[OBJECTIVE_DEV_SIMULATOR_ROLE_ENV] ?? "developer",
  });
}
