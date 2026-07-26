import { ObjectivePhase4DemoCockpit } from "./ObjectivePhase4DemoCockpit";

export function ObjectivePhase4ConsoleShell() {
  return (
    <section
      aria-labelledby="objective-phase4-console-title"
      className="flex flex-col gap-4"
    >
      <h2 id="objective-phase4-console-title" className="sr-only">
        Objective Monitoring Console
      </h2>
      <ObjectivePhase4DemoCockpit />
    </section>
  );
}
