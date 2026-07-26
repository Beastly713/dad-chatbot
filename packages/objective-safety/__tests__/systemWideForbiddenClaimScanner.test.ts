import fs from "fs";
import path from "path";
import {
  assertNoForbiddenObjectiveTermViolations,
  findForbiddenObjectiveTermViolations,
} from "../src/index.js";

type ScannerSurface = "source" | "route" | "ui_copy" | "api_field" | "db_column";

type ScanItem = {
  path: string;
  surface: ScannerSurface;
  content: string;
};

const SCAN_ROOTS = [
  "backend/src",
  "frontend/app",
  "frontend/lib",
  "frontend/types",
  "frontend/__tests__",
  "services/objective-backend/src",
  "services/objective-backend/__tests__",
  "packages/objective-schemas/src",
  "packages/objective-schemas/__tests__",
  "packages/objective-simulator/src",
  "packages/objective-simulator/__tests__",
  "packages/objective-preprocessing/src",
  "packages/objective-preprocessing/__tests__",
  "packages/objective-interpretation/src",
  "packages/objective-interpretation/__tests__",
  "packages/objective-safety/src",
  "packages/objective-safety/__tests__",
  "services/objective-ml/objective_ml",
  "supabase/migrations",
] as const;

const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".sql",
  ".py",
  ".json",
]);

const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".yarn",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "__pycache__",
]);

const REQUIRED_SCAN_ROOTS = [
  "backend/src",
  "frontend/app",
  "services/objective-backend/src",
  "packages/objective-safety/src",
  "packages/objective-schemas/src",
  "packages/objective-simulator/src",
  "packages/objective-preprocessing/src",
  "packages/objective-interpretation/src",
  "supabase/migrations",
] as const;

const ALLOWED_FORBIDDEN_TERM_CONTEXTS = [
  /^backend\/src\/retrieval_graph\/(prompts|stateSummary)\.ts$/,
  /^backend\/src\/safety\/.*\.(ts|tsx|js|jsx)$/,
  /^services\/objective-backend\/src\/(interpretationStorage|mlInferenceContract|rawIngestion|streamEvents)\.ts$/,
  /^services\/objective-ml\/objective_ml\/contracts\.py$/,
  /^packages\/objective-safety\/src\/(registries|scanner|sourceScanner)\.ts$/,
  /(^|\/)__tests__\/.*\.test\.(ts|tsx|js|jsx)$/,
  /^packages\/objective-safety\/__tests__\/.*\.test\.ts$/,
  /(^|\/)__tests__\/.*(safety|Safety|scanner|Scanner|forbidden|Forbidden|boundary|Boundary|noLeak|NoLeak|regression|Regression|phase\d+|Phase\d+|stage\d+|Stage\d+|security|Security|redteam|Redteam).*\.test\.(ts|tsx|js|jsx)$/,
] as const;

function findRepoRoot(): string {
  let current = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    if (
      fs.existsSync(path.join(current, "package.json")) &&
      fs.existsSync(path.join(current, "turbo.json"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(`Could not locate repo root from cwd: ${process.cwd()}`);
}

const REPO_ROOT = findRepoRoot();

function toRepoRelativePath(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
}

function repoPath(relativePath: string): string {
  return path.join(REPO_ROOT, relativePath);
}

function collectScannableFiles(relativeRoot: string): string[] {
  const absoluteRoot = repoPath(relativeRoot);

  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const results: string[] = [];

  function visit(currentDirectory: string): void {
    for (const entry of fs.readdirSync(currentDirectory, {
      withFileTypes: true,
    })) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          continue;
        }

        visit(path.join(currentDirectory, entry.name));
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name);

      if (!SCANNED_EXTENSIONS.has(extension)) {
        continue;
      }

      results.push(path.join(currentDirectory, entry.name));
    }
  }

  visit(absoluteRoot);
  return results;
}

function surfaceForFile(relativePath: string): ScannerSurface {
  if (relativePath.startsWith("supabase/migrations/")) {
    return "db_column";
  }

  if (
    relativePath.includes("/app/") ||
    relativePath.startsWith("frontend/app/") ||
    relativePath.includes("Routes") ||
    relativePath.includes("route.")
  ) {
    return "route";
  }

  if (
    relativePath.includes("frontend/") ||
    relativePath.includes("_components/") ||
    relativePath.includes("_lib/")
  ) {
    return "ui_copy";
  }

  if (
    relativePath.includes("schemas") ||
    relativePath.includes("Contract") ||
    relativePath.includes("contract") ||
    relativePath.includes("types")
  ) {
    return "api_field";
  }

  return "source";
}

function isAllowedForbiddenTermContext(relativePath: string): boolean {
  return ALLOWED_FORBIDDEN_TERM_CONTEXTS.some((pattern) =>
    pattern.test(relativePath),
  );
}

function buildScanItems(): ScanItem[] {
  const seen = new Set<string>();
  const items: ScanItem[] = [];

  for (const relativeRoot of SCAN_ROOTS) {
    for (const absolutePath of collectScannableFiles(relativeRoot)) {
      const relativePath = toRepoRelativePath(absolutePath);

      if (seen.has(relativePath)) {
        continue;
      }

      seen.add(relativePath);

      const content = fs.readFileSync(absolutePath, "utf8");
      const surface = surfaceForFile(relativePath);

      items.push({
        path: relativePath,
        surface,
        content,
      });

      if (
        relativePath.startsWith("frontend/app/") ||
        relativePath.includes("/routes/") ||
        relativePath.includes("Routes") ||
        relativePath.includes("route.")
      ) {
        items.push({
          path: `${relativePath}#route-name`,
          surface: "route",
          content: relativePath,
        });
      }
    }
  }

  return items;
}

function findSystemWideViolations(scanItems: readonly ScanItem[]) {
  return scanItems.flatMap((item) => {
    if (isAllowedForbiddenTermContext(item.path)) {
      return [];
    }

    return findForbiddenObjectiveTermViolations([item]).filter(
      (violation) =>
        violation.category !== "route_segment" || item.surface === "route",
    );
  });
}

describe("system-wide objective forbidden-claim scanner", () => {
  it("scans all required executable roots", () => {
    for (const relativeRoot of REQUIRED_SCAN_ROOTS) {
      expect(fs.existsSync(repoPath(relativeRoot))).toBe(true);
    }

    const scannedPaths = buildScanItems().map((item) => item.path);

    for (const relativeRoot of REQUIRED_SCAN_ROOTS) {
      expect(
        scannedPaths.some((scannedPath) => scannedPath.startsWith(relativeRoot)),
      ).toBe(true);
    }
  });

  it("keeps executable source, routes, schemas, DTOs, UI copy, ML artifacts, and DB migrations free of forbidden objective claims", () => {
    const scanItems = buildScanItems();
    const violations = findSystemWideViolations(scanItems);

    expect(violations).toEqual([]);
  });

  it("fails ordinary executable files that introduce forbidden objective labels, fields, or route segments", () => {
    const violations = findSystemWideViolations([
      {
        path: "services/objective-backend/src/unsafeExample.ts",
        surface: "source",
        content: `
          export const unsafe = {
            relapse_risk: "high",
            cravingDetected: true,
            patient_is_safe: false
          };
        `,
      },
      {
        path: "frontend/app/(clinician)/clinician/relapse-risk/page.tsx#route-name",
        surface: "route",
        content: "frontend/app/(clinician)/clinician/relapse-risk/page.tsx",
      },
      {
        path: "supabase/migrations/99999999999999_unsafe.sql",
        surface: "db_column",
        content: `
          alter table objective.interpretation_records
          add column withdrawal_risk text;
        `,
      },
    ]);

    expect(violations.map((violation) => violation.term)).toEqual(
      expect.arrayContaining([
        "relapse_risk",
        "patient_is_safe",
        "relapse-risk",
        "withdrawal_risk",
      ]),
    );
  });

  it("allows forbidden examples only inside explicit safety registries and scanner/negative-test fixtures", () => {
    const allowedFixtureItems: ScanItem[] = [
      {
        path: "packages/objective-safety/src/registries.ts",
        surface: "source",
        content: `
          export const forbidden = [
            "relapse_risk",
            "withdrawal_risk",
            "CIWA_score"
          ];
        `,
      },
      {
        path: "packages/objective-safety/__tests__/scanner.test.ts",
        surface: "source",
        content: `
          expect(findForbiddenObjectiveTerms("craving_detected")).toHaveLength(1);
        `,
      },
      {
        path: "backend/src/retrieval_graph/__tests__/phase3NoLeakBoundaries.test.ts",
        surface: "source",
        content: `
          const hiddenObjectivePayload = {
            relapse_risk: "high",
            intoxication_detected: true
          };
        `,
      },
    ];

    expect(findSystemWideViolations(allowedFixtureItems)).toEqual([]);

    expect(() =>
      assertNoForbiddenObjectiveTermViolations([
        {
          path: "services/objective-backend/src/unsafeExecutable.ts",
          surface: "source",
          content: 'const label = "craving_detected";',
        },
      ]),
    ).toThrow("Forbidden objective terms found");
  });
});
