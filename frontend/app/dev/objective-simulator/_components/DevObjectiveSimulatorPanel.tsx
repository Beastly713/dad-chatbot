import type {
  ObjectiveDevOnlyLabel,
  ObjectiveDevSimulatorAccess,
  ObjectiveDevSimulatorControl,
  ObjectiveDevSimulatorScenario,
} from "../_lib/devObjectiveSimulatorConfig";

type DevObjectiveSimulatorPanelProps = {
  access: ObjectiveDevSimulatorAccess;
  scenarios: ObjectiveDevSimulatorScenario[];
  controls: ObjectiveDevSimulatorControl[];
  developerLabels: ObjectiveDevOnlyLabel[];
};

export function DevObjectiveSimulatorPanel({
  access,
  scenarios,
  controls,
  developerLabels,
}: DevObjectiveSimulatorPanelProps) {
  const disabled = !access.allowed;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="rounded-lg border bg-background p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Developer/debug objective simulator
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          Objective simulator control panel
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          This route is for local engineering checks only. It is not a clinician
          dashboard, not a patient view, and not connected to chatbot behavior.
        </p>
        <p
          className="mt-4 rounded-md border p-3 text-sm"
          data-testid="dev-objective-simulator-access-banner"
        >
          {access.banner}
        </p>
      </header>

      <section
        aria-labelledby="dev-objective-simulator-controls"
        className="rounded-lg border bg-background p-6"
      >
        <h2 id="dev-objective-simulator-controls" className="text-xl font-semibold">
          Simulator controls
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Controls are disabled unless the server-side developer/debug flag is
          enabled. This scaffold does not write to backend ingestion routes.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Choose scenario
            <select
              aria-label="Choose simulator scenario"
              className="rounded-md border bg-background px-3 py-2"
              defaultValue="baseline_rest"
              disabled={disabled}
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Choose seed
            <input
              aria-label="Choose deterministic simulator seed"
              className="rounded-md border bg-background px-3 py-2"
              type="number"
              min={0}
              defaultValue={713}
              disabled={disabled}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm font-medium"
            disabled={disabled}
          >
            Start stream
          </button>
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm font-medium"
            disabled={disabled}
          >
            Stop stream
          </button>
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm font-medium"
            disabled={disabled}
          >
            Inject artifact
          </button>
        </div>

        <ul className="mt-5 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          {controls.map((control) => (
            <li key={control.id} className="rounded-md border p-3">
              <span className="font-medium text-foreground">{control.label}</span>
              <span className="mt-1 block">{control.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="dev-objective-simulator-scenarios"
        className="rounded-lg border bg-background p-6"
      >
        <h2 id="dev-objective-simulator-scenarios" className="text-xl font-semibold">
          Scenario catalogue
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <article key={scenario.id} className="rounded-md border p-3">
              <h3 className="font-medium">{scenario.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {scenario.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="dev-objective-simulator-labels"
        className="rounded-lg border bg-background p-6"
      >
        <h2 id="dev-objective-simulator-labels" className="text-xl font-semibold">
          Developer-only labels
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          These labels are local debug data for engineering validation. They are
          not clinician dashboard output and must not appear in patient or chatbot
          surfaces.
        </p>

        {access.allowed ? (
          <dl className="mt-4 grid gap-3">
            {developerLabels.map((label) => (
              <div key={label.id} className="rounded-md border p-3">
                <dt className="text-sm font-medium">{label.label}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {label.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 rounded-md border p-3 text-sm text-muted-foreground">
            Developer-only labels are hidden while developer/debug mode is
            disabled.
          </p>
        )}
      </section>
    </main>
  );
}
