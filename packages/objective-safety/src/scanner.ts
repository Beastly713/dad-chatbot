import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
} from "./registries.js";

export type ForbiddenObjectiveTermCategory =
  | "label"
  | "field"
  | "route_segment";

export type ForbiddenObjectiveTermMatch = {
  term: string;
  category: ForbiddenObjectiveTermCategory;
};

function uniqueMatches(
  matches: ForbiddenObjectiveTermMatch[],
): ForbiddenObjectiveTermMatch[] {
  const seen = new Set<string>();

  return matches.filter((match) => {
    const key = match.term;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function containsTerm(sourceText: string, term: string): boolean {
  return sourceText.includes(term);
}

export function findForbiddenObjectiveTerms(
  sourceText: string,
): ForbiddenObjectiveTermMatch[] {
  const matches: ForbiddenObjectiveTermMatch[] = [];

  for (const label of FORBIDDEN_OBJECTIVE_LABELS) {
    if (containsTerm(sourceText, label)) {
      matches.push({ term: label, category: "label" });
    }
  }

  for (const field of FORBIDDEN_OBJECTIVE_FIELD_NAMES) {
    if (containsTerm(sourceText, field)) {
      matches.push({ term: field, category: "field" });
    }
  }

  for (const routeSegment of FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS) {
    if (containsTerm(sourceText, routeSegment)) {
      matches.push({ term: routeSegment, category: "route_segment" });
    }
  }

  return uniqueMatches(matches);
}

export function hasForbiddenObjectiveTerms(sourceText: string): boolean {
  return findForbiddenObjectiveTerms(sourceText).length > 0;
}

export function assertNoForbiddenObjectiveTerms(sourceText: string): void {
  const matches = findForbiddenObjectiveTerms(sourceText);

  if (matches.length === 0) {
    return;
  }

  const formattedMatches = matches
    .map((match) => `${match.category}:${match.term}`)
    .join(", ");

  throw new Error(`Forbidden objective terms found: ${formattedMatches}`);
}
