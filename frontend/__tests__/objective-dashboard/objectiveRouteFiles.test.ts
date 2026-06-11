import fs from "fs";
import path from "path";

const FRONTEND_ROOT = process.cwd();

function appPath(...segments: string[]): string {
  return path.join(FRONTEND_ROOT, "app", ...segments);
}

function repoRelative(filePath: string): string {
  return path.relative(FRONTEND_ROOT, filePath).split(path.sep).join("/");
}

function collectFiles(directory: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(directory)) {
    return files;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("clinician objective dashboard route skeleton", () => {
  it("adds only the intended clinician objective route files", () => {
    const routeRoot = appPath("(clinician)", "clinician", "objective");

    for (const expected of [
      appPath("(clinician)", "clinician", "objective", "page.tsx"),
      appPath("(clinician)", "clinician", "objective", "patients", "page.tsx"),
      appPath(
        "(clinician)",
        "clinician",
        "objective",
        "patients",
        "[patientId]",
        "sessions",
        "page.tsx",
      ),
      appPath(
        "(clinician)",
        "clinician",
        "objective",
        "sessions",
        "[sessionId]",
        "page.tsx",
      ),
      appPath(
        "(clinician)",
        "clinician",
        "objective",
        "live",
        "[sessionId]",
        "page.tsx",
      ),
    ]) {
      expect(fs.existsSync(expected)).toBe(true);
    }

    expect(collectFiles(routeRoot).length).toBeGreaterThanOrEqual(8);
  });

  it("does not create patient, chatbot, or unsafe clinician objective routes", () => {
    const unsafeRouteCandidates = [
      appPath("patient", "objective", "page.tsx"),
      appPath("chat", "physiology", "page.tsx"),
      appPath("chat", "objective-context", "page.tsx"),
      appPath("clinician", ["relapse", "risk"].join("-"), "page.tsx"),
      appPath("clinician", ["withdrawal", "risk"].join("-"), "page.tsx"),
      appPath("clinician", "intoxication", "page.tsx"),
      appPath("clinician", "ciwa", "page.tsx"),
    ];

    for (const unsafeRoute of unsafeRouteCandidates) {
      expect(fs.existsSync(unsafeRoute)).toBe(false);
    }
  });

  it("keeps dashboard route skeleton copy bounded and non-diagnostic", () => {
    const files = collectFiles(appPath("(clinician)", "clinician", "objective"))
      .filter((file) => /\.(ts|tsx)$/.test(file));

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8").toLowerCase();

      for (const forbidden of [
        "risk score",
        "emergency alert",
        "diagnose the patient",
        "clinical decision-maker",
        "sobriety status",
        "patient is safe",
        "patient is stable",
        "patient is lying",
        "craving detected",
        "relapse risk",
        "withdrawal risk",
        "treatment need",
        "detox need",
        "medication need",
      ]) {
        if (content.includes(forbidden)) {
          throw new Error(
            `${repoRelative(file)} contains forbidden dashboard copy: ${forbidden}`,
          );
        }
      }
    }
  });

  it("does not import chatbot routes or LangGraph modules into dashboard skeleton", () => {
    const files = collectFiles(appPath("(clinician)", "clinician", "objective"))
      .filter((file) => /\.(ts|tsx)$/.test(file));

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");

      for (const forbidden of [
        /app\/api\/chat/,
        /langgraph/i,
        /retrieval_graph/,
        /finalGuard/,
        /subjective/,
      ]) {
        if (forbidden.test(content)) {
          throw new Error(
            `${repoRelative(file)} contains forbidden import or reference: ${forbidden}`,
          );
        }
      }
    }
  });
});
