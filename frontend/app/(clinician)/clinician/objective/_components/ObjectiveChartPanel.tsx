import type { ObjectiveChartSeries } from "../_lib/chartReadySignals";

function buildPolyline(points: ObjectiveChartSeries["points"]): string {
  if (points.length === 0) {
    return "";
  }

  const minX = Math.min(...points.map((point) => point.tMs));
  const maxX = Math.max(...points.map((point) => point.tMs));
  const minY = Math.min(...points.map((point) => point.value));
  const maxY = Math.max(...points.map((point) => point.value));

  const xRange = Math.max(1, maxX - minX);
  const yRange = Math.max(1, maxY - minY);

  return points
    .map((point) => {
      const x = ((point.tMs - minX) / xRange) * 100;
      const y = 100 - ((point.value - minY) / yRange) * 70 - 15;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function ObjectiveChartPanel({
  series,
}: {
  series: ObjectiveChartSeries;
}) {
  const polyline = buildPolyline(series.points);
  const first = series.points[0];
  const latest = series.points[series.points.length - 1];

  return (
    <article className="rounded-lg border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Chart-ready signal
        </p>
        <h3 className="text-lg font-semibold tracking-tight">{series.title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          {series.subtitle}
        </p>
      </div>

      <div className="mt-4 rounded-md border bg-muted/20 p-3">
        <svg
          aria-label={`${series.title} chart-ready preview`}
          role="img"
          viewBox="0 0 100 100"
          className="h-32 w-full"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1="85"
            x2="100"
            y2="85"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="15"
            x2="100"
            y2="15"
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="1"
          />
          <polyline
            points={polyline}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Y-axis</dt>
          <dd className="font-medium">{series.yLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Points</dt>
          <dd className="font-medium">{series.points.length} downsampled</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Latest value</dt>
          <dd className="font-medium">
            {latest ? formatValue(latest.value) : "No data"}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {series.sourceNote}
      </p>

      {first && latest ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Window preview: {first.tMs} ms to {latest.tMs} ms.
        </p>
      ) : null}
    </article>
  );
}
