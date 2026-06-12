import { DevObjectiveSimulatorPanel } from "./_components/DevObjectiveSimulatorPanel";
import {
  OBJECTIVE_DEV_ONLY_LABELS,
  OBJECTIVE_DEV_SIMULATOR_CONTROLS,
  OBJECTIVE_DEV_SIMULATOR_SCENARIOS,
  resolveObjectiveDevSimulatorAccessFromEnv,
} from "./_lib/devObjectiveSimulatorConfig";

export const dynamic = "force-dynamic";

export default function DevObjectiveSimulatorPage() {
  const access = resolveObjectiveDevSimulatorAccessFromEnv();

  return (
    <DevObjectiveSimulatorPanel
      access={access}
      scenarios={OBJECTIVE_DEV_SIMULATOR_SCENARIOS}
      controls={OBJECTIVE_DEV_SIMULATOR_CONTROLS}
      developerLabels={OBJECTIVE_DEV_ONLY_LABELS}
    />
  );
}
