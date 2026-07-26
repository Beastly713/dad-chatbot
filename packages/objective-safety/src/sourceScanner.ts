// packages/objective-safety/src/sourceScanner.ts

import {
  findForbiddenObjectiveTerms,
  type ForbiddenObjectiveTermMatch,
} from "./scanner.js";

export type ObjectiveScannerSurface =
  | "route"
  | "enum"
  | "db_column"
  | "api_field"
  | "ui_copy"
  | "ml_target"
  | "interpretation_label"
  | "source";

export type ObjectiveSourceFile = {
  path: string;
  content: string;
  surface?: ObjectiveScannerSurface;
};

export type ObjectiveForbiddenTermViolation = {
  path: string;
  term: string;
  category: ForbiddenObjectiveTermMatch["category"];
  surface: ObjectiveScannerSurface;
  line: number;
  column: number;
  lineText: string;
};

export type ObjectiveForbiddenTermScanOptions = {
  /**
   * Files that are allowed to contain forbidden terms because they define the
   * registry itself or explicit negative-test fixtures.
   */
  allowedPathSubstrings?: readonly string[];

  /**
   * Inline escape hatch for future rare fixtures.
   * Do not use in production code. Tests can include this marker.
   */
  allowedLineMarkers?: readonly string[];
};

const DEFAULT_ALLOWED_PATH_SUBSTRINGS = [
  "packages/objective-safety/src/registries.ts",
  "packages/objective-safety/__tests__/",
  "backend/src/retrieval_graph/__tests__/",
] as const;

const DEFAULT_ALLOWED_LINE_MARKERS = [
  "@objective-safety-allow-forbidden-term",
] as const;

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function shouldAllowPath(
  filePath: string,
  allowedPathSubstrings: readonly string[],
): boolean {
  const normalizedPath = normalizePath(filePath);

  return allowedPathSubstrings.some((allowedPath) =>
    normalizedPath.includes(normalizePath(allowedPath)),
  );
}

function shouldAllowLine(
  lineText: string,
  allowedLineMarkers: readonly string[],
): boolean {
  return allowedLineMarkers.some((marker) => lineText.includes(marker));
}

function inferSurfaceFromPath(filePath: string): ObjectiveScannerSurface {
  const normalizedPath = normalizePath(filePath);

  if (normalizedPath.includes("/app/") || normalizedPath.includes("/route.")) {
    return "route";
  }

  if (
    normalizedPath.includes("/migrations/") ||
    normalizedPath.endsWith(".sql")
  ) {
    return "db_column";
  }

  if (
    normalizedPath.includes("/schemas/") ||
    normalizedPath.includes("schema") ||
    normalizedPath.includes("types")
  ) {
    return "api_field";
  }

  if (
    normalizedPath.includes("/components/") ||
    normalizedPath.includes("/copy/") ||
    normalizedPath.endsWith(".tsx")
  ) {
    return "ui_copy";
  }

  return "source";
}

function findLineColumn(
  content: string,
  term: string,
): { line: number; column: number; lineText: string } {
  const index = content.indexOf(term);

  if (index < 0) {
    return { line: 1, column: 1, lineText: "" };
  }

  const beforeTerm = content.slice(0, index);
  const line = beforeTerm.split("\n").length;
  const lineStartIndex = beforeTerm.lastIndexOf("\n") + 1;
  const lineEndIndex = content.indexOf("\n", index);
  const column = index - lineStartIndex + 1;
  const lineText =
    lineEndIndex === -1
      ? content.slice(lineStartIndex)
      : content.slice(lineStartIndex, lineEndIndex);

  return { line, column, lineText };
}

export function findForbiddenObjectiveTermViolations(
  files: readonly ObjectiveSourceFile[],
  options: ObjectiveForbiddenTermScanOptions = {},
): ObjectiveForbiddenTermViolation[] {
  const allowedPathSubstrings = [
    ...DEFAULT_ALLOWED_PATH_SUBSTRINGS,
    ...(options.allowedPathSubstrings ?? []),
  ];
  const allowedLineMarkers = [
    ...DEFAULT_ALLOWED_LINE_MARKERS,
    ...(options.allowedLineMarkers ?? []),
  ];
  const violations: ObjectiveForbiddenTermViolation[] = [];

  for (const file of files) {
    if (shouldAllowPath(file.path, allowedPathSubstrings)) {
      continue;
    }

    const matches = findForbiddenObjectiveTerms(file.content);

    for (const match of matches) {
      const location = findLineColumn(file.content, match.term);

      if (shouldAllowLine(location.lineText, allowedLineMarkers)) {
        continue;
      }

      violations.push({
        path: normalizePath(file.path),
        term: match.term,
        category: match.category,
        surface: file.surface ?? inferSurfaceFromPath(file.path),
        line: location.line,
        column: location.column,
        lineText: location.lineText.trim(),
      });
    }
  }

  return violations;
}

export function assertNoForbiddenObjectiveTermViolations(
  files: readonly ObjectiveSourceFile[],
  options: ObjectiveForbiddenTermScanOptions = {},
): void {
  const violations = findForbiddenObjectiveTermViolations(files, options);

  if (violations.length === 0) {
    return;
  }

  const formatted = violations
    .map(
      (violation) =>
        `${violation.path}:${violation.line}:${violation.column} ` +
        `[${violation.surface}] ${violation.category}:${violation.term}`,
    )
    .join("\n");

  throw new Error(`Forbidden objective terms found:\n${formatted}`);
}
