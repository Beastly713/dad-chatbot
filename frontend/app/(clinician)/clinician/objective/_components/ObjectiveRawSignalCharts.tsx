import {
  createObjectiveDemoChartSeries,
  type ObjectiveChartSeries,
} from "../_lib/chartReadySignals";
import { ObjectiveChartPanel } from "./ObjectiveChartPanel";

export function ObjectiveRawSignalCharts({
  series = createObjectiveDemoChartSeries(),
}: {
  series?: ObjectiveChartSeries[];
}) {
  return (
    <section
      aria-labelledby="objective-raw-signal-charts-title"
      className="flex flex-col gap-4"
    >
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Chart-ready signal previews
        </p>
        <h2
          id="objective-raw-signal-charts-title"
          className="mt-2 text-2xl font-semibold tracking-tight"
        >
          Physiological and device-context preview cards
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          These panels show downsampled chart-ready previews for clinician
          review. They are source-bound monitoring views, not clinical
          decisions.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {series.map((item) => (
          <ObjectiveChartPanel key={item.kind} series={item} />
        ))}
      </div>
    </section>
  );
}
