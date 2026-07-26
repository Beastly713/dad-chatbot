import {
  OBJECTIVE_SIMULATOR_SCHEMA_VERSION,
  OBJECTIVE_SIMULATOR_SOURCE_TYPE,
  type ObjectiveSimulatorPhaseType,
  type ObjectiveSimulatorScenarioId,
  type ObjectiveSimulatorVisibility,
  assertObjectiveSimulatorScenarioId,
  createObjectiveSimulatorVisibility
} from "./types.js";
import { getObjectiveSimulatorScenarioProfile } from "./scenarios.js";

type ObjectiveSimulatorPhaseTemplate = {
  phase_type: ObjectiveSimulatorPhaseType;
  weight: number;
  relative_intensity: number;
};

export type GenerateObjectiveScenarioTimelineOptions = {
  scenario_id: string;
  seed: number;
  duration_ms: number;
  start_esp_time_ms?: number;
};

export type ObjectiveSimulatorTimelinePhase = {
  schema_version: typeof OBJECTIVE_SIMULATOR_SCHEMA_VERSION;
  scenario_id: ObjectiveSimulatorScenarioId;
  phase_id: string;
  phase_type: ObjectiveSimulatorPhaseType;
  start_esp_time_ms: number;
  end_esp_time_ms: number;
  relative_intensity: number;
  visibility: ObjectiveSimulatorVisibility;
  developer_labels_visible: false;
  metadata: {
    source_type: typeof OBJECTIVE_SIMULATOR_SOURCE_TYPE;
    sequence_index: number;
    seed: number;
    engineering_only: true;
  };
};

export type ObjectiveSimulatorTimeline = {
  schema_version: typeof OBJECTIVE_SIMULATOR_SCHEMA_VERSION;
  scenario_id: ObjectiveSimulatorScenarioId;
  source_type: typeof OBJECTIVE_SIMULATOR_SOURCE_TYPE;
  seed: number;
  duration_ms: number;
  start_esp_time_ms: number;
  end_esp_time_ms: number;
  visibility: ObjectiveSimulatorVisibility;
  developer_labels_visible: false;
  phases: ObjectiveSimulatorTimelinePhase[];
  metadata: {
    source_banner: string;
    engineering_only: true;
    clinical_validation_claim: false;
  };
};

const PHASE_PLANS: Record<
  ObjectiveSimulatorScenarioId,
  readonly ObjectiveSimulatorPhaseTemplate[]
> = {
  baseline_rest: [
    {
      phase_type: "baseline_period",
      weight: 1,
      relative_intensity: 0.1
    }
  ],

  elevated_arousal_pattern: [
    {
      phase_type: "baseline_period",
      weight: 0.3,
      relative_intensity: 0.15
    },
    {
      phase_type: "elevated_arousal_period",
      weight: 0.5,
      relative_intensity: 0.75
    },
    {
      phase_type: "recovery_period",
      weight: 0.2,
      relative_intensity: 0.35
    }
  ],

  recovery_cooldown: [
    {
      phase_type: "elevated_arousal_period",
      weight: 0.35,
      relative_intensity: 0.7
    },
    {
      phase_type: "recovery_period",
      weight: 0.45,
      relative_intensity: 0.35
    },
    {
      phase_type: "baseline_period",
      weight: 0.2,
      relative_intensity: 0.15
    }
  ],

  motion_artifact: [
    {
      phase_type: "baseline_period",
      weight: 0.25,
      relative_intensity: 0.15
    },
    {
      phase_type: "movement_confound_period",
      weight: 0.55,
      relative_intensity: 0.8
    },
    {
      phase_type: "recovery_period",
      weight: 0.2,
      relative_intensity: 0.3
    }
  ],

  poor_contact: [
    {
      phase_type: "baseline_period",
      weight: 0.25,
      relative_intensity: 0.15
    },
    {
      phase_type: "signal_quality_limitation_period",
      weight: 0.55,
      relative_intensity: 0.65
    },
    {
      phase_type: "recovery_period",
      weight: 0.2,
      relative_intensity: 0.3
    }
  ],

  sensor_dropout: [
    {
      phase_type: "baseline_period",
      weight: 0.3,
      relative_intensity: 0.15
    },
    {
      phase_type: "sensor_dropout_period",
      weight: 0.5,
      relative_intensity: 0.6
    },
    {
      phase_type: "recovery_period",
      weight: 0.2,
      relative_intensity: 0.25
    }
  ],

  signal_conflict: [
    {
      phase_type: "baseline_period",
      weight: 0.25,
      relative_intensity: 0.15
    },
    {
      phase_type: "cross_signal_conflict_period",
      weight: 0.55,
      relative_intensity: 0.7
    },
    {
      phase_type: "recovery_period",
      weight: 0.2,
      relative_intensity: 0.3
    }
  ],

  device_reset_or_timing_gap: [
    {
      phase_type: "baseline_period",
      weight: 0.25,
      relative_intensity: 0.15
    },
    {
      phase_type: "timing_gap_period",
      weight: 0.25,
      relative_intensity: 0.45
    },
    {
      phase_type: "device_reset_period",
      weight: 0.25,
      relative_intensity: 0.45
    },
    {
      phase_type: "recovery_period",
      weight: 0.25,
      relative_intensity: 0.25
    }
  ]
};

function assertNonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  return value;
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function allocateDurations(
  templates: readonly ObjectiveSimulatorPhaseTemplate[],
  durationMs: number
): number[] {
  if (durationMs < templates.length) {
    throw new Error("duration_ms is too short for the selected scenario");
  }

  const totalWeight = templates.reduce((sum, template) => sum + template.weight, 0);
  let usedDurationMs = 0;

  return templates.map((template, index) => {
    if (index === templates.length - 1) {
      return durationMs - usedDurationMs;
    }

    const duration = Math.max(
      1,
      Math.floor((durationMs * template.weight) / totalWeight)
    );
    usedDurationMs += duration;

    return duration;
  });
}

function buildPhaseId(
  scenarioId: ObjectiveSimulatorScenarioId,
  seed: number,
  sequenceIndex: number,
  phaseType: ObjectiveSimulatorPhaseType
): string {
  return `sim-${scenarioId}-${seed}-${sequenceIndex}-${phaseType}`;
}

export function generateObjectiveScenarioTimeline(
  options: GenerateObjectiveScenarioTimelineOptions
): ObjectiveSimulatorTimeline {
  const scenarioId = assertObjectiveSimulatorScenarioId(options.scenario_id);
  const seed = assertNonNegativeInteger(options.seed, "seed");
  const durationMs = assertPositiveInteger(options.duration_ms, "duration_ms");
  const startEspTimeMs = assertNonNegativeInteger(
    options.start_esp_time_ms ?? 0,
    "start_esp_time_ms"
  );

  const profile = getObjectiveSimulatorScenarioProfile(scenarioId);
  const templates = PHASE_PLANS[scenarioId];
  const phaseDurations = allocateDurations(templates, durationMs);

  let phaseStartEspTimeMs = startEspTimeMs;

  const phases = templates.map((template, index): ObjectiveSimulatorTimelinePhase => {
    const phaseDurationMs = phaseDurations[index];
    const phaseEndEspTimeMs = phaseStartEspTimeMs + phaseDurationMs;

    const phase: ObjectiveSimulatorTimelinePhase = {
      schema_version: OBJECTIVE_SIMULATOR_SCHEMA_VERSION,
      scenario_id: scenarioId,
      phase_id: buildPhaseId(scenarioId, seed, index + 1, template.phase_type),
      phase_type: template.phase_type,
      start_esp_time_ms: phaseStartEspTimeMs,
      end_esp_time_ms: phaseEndEspTimeMs,
      relative_intensity: template.relative_intensity,
      visibility: createObjectiveSimulatorVisibility(),
      developer_labels_visible: false,
      metadata: {
        source_type: OBJECTIVE_SIMULATOR_SOURCE_TYPE,
        sequence_index: index,
        seed,
        engineering_only: true
      }
    };

    phaseStartEspTimeMs = phaseEndEspTimeMs;

    return phase;
  });

  return {
    schema_version: OBJECTIVE_SIMULATOR_SCHEMA_VERSION,
    scenario_id: scenarioId,
    source_type: OBJECTIVE_SIMULATOR_SOURCE_TYPE,
    seed,
    duration_ms: durationMs,
    start_esp_time_ms: startEspTimeMs,
    end_esp_time_ms: startEspTimeMs + durationMs,
    visibility: createObjectiveSimulatorVisibility(),
    developer_labels_visible: false,
    phases,
    metadata: {
      source_banner: profile.source_metadata.source_banner,
      engineering_only: true,
      clinical_validation_claim: false
    }
  };
}
