export function ObjectiveRoutePlaceholder({
  heading,
  detail,
}: {
  heading: string;
  detail: string;
}) {
  return (
    <section
      aria-labelledby="objective-route-placeholder-title"
      className="rounded-lg border bg-background p-6 shadow-sm"
    >
      <h2
        id="objective-route-placeholder-title"
        className="text-xl font-semibold tracking-tight"
      >
        {heading}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Live charts, signal-quality cards, interpretation cards, timelines, and
        clinician notes are intentionally added in later commits.
      </p>
    </section>
  );
}
