import fs from "fs";
import path from "path";

const FRONTEND_ROOT = process.cwd();

function appPath(...segments: string[]): string {
  return path.join(FRONTEND_ROOT, "app", ...segments);
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
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
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function expectNoMatch(content: string, file: string, pattern: RegExp): void {
  if (pattern.test(content)) {
    throw new Error(
      `${repoRelative(file)} contains forbidden import or reference: ${pattern}`,
    );
  }
}

describe("objective live monitoring shell files", () => {
  const routeRoot = appPath("(clinician)", "clinician", "objective");
  const livePage = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "live",
    "[sessionId]",
    "page.tsx",
  );
  const liveShell = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_components",
    "ObjectiveLiveMonitoringShell.tsx",
  );
  const liveCopy = appPath(
    "(clinician)",
    "clinician",
    "objective",
    "_lib",
    "liveMonitoringCopy.ts",
  );

  it("adds the live shell to the clinician live route only", () => {
    expect(fs.existsSync(liveShell)).toBe(true);
    expect(fs.existsSync(liveCopy)).toBe(true);

    const pageContent = read(livePage);
    expect(pageContent).toContain("ObjectiveLiveMonitoringShell");
    expect(pageContent).toContain('sourceType="simulator"');
    expect(pageContent).toContain('connectionStatus="not_connected"');
    expect(pageContent).toContain('liveStatus="no_data"');
  });

  it("contains required shell sections", () => {
    const combined = `${read(liveShell)}\n${read(liveCopy)}`;

    for (const required of [
      "Live session shell",
      "Source",
      "Connection",
      "Live status",
      "Scope note",
      "No clinician-safe stream data yet",
      "Simulated data",
      "Degraded",
      "No data yet",
      "non-diagnostic",
    ]) {
      expect(combined).toContain(required);
    }
  });

  it("does not add a frontend WebSocket client yet", () => {
    const files = collectFiles(routeRoot).filter((file) =>
      /\.(ts|tsx)$/.test(file),
    );

    for (const file of files) {
      const content = read(file);

      for (const pattern of [
        /new\s+WebSocket/,
        /EventSource/,
        /text\/event-stream/,
        /server-sent/i,
        /\/api\/objective\/sessions\/.*\/stream/,
      ]) {
        expectNoMatch(content, file, pattern);
      }
    }
  });

  it("does not import chatbot, LangGraph, or subjective modules", () => {
    const files = collectFiles(routeRoot).filter((file) =>
      /\.(ts|tsx)$/.test(file),
    );

    for (const file of files) {
      const content = read(file);

      for (const pattern of [
        /app\/api\/chat/,
        /langgraph/i,
        /retrieval_graph/,
        /finalGuard/,
        /subjective/,
      ]) {
        expectNoMatch(content, file, pattern);
      }
    }
  });

  it("keeps live shell copy free of unsafe dashboard language", () => {
    const files = [liveShell, liveCopy, livePage];

    for (const file of files) {
      const content = read(file).toLowerCase();

      for (const forbidden of [
        "risk score",
        "emergency",
        "alert",
        "diagnose the patient",
        "clinical decision-maker",
        "sobriety status",
        "patient is safe",
        "patient is stable",
        "patient is lying",
        "craving detected",
        "relapse risk",
        "withdrawal risk",
        "intoxication",
        "treatment need",
        "detox need",
        "medication need",
        "ciwa",
      ]) {
        if (content.includes(forbidden)) {
          throw new Error(
            `${repoRelative(file)} contains forbidden dashboard copy: ${forbidden}`,
          );
        }
      }
    }
  });

  it("still does not create patient or chatbot objective routes", () => {
    for (const forbiddenRoute of [
      appPath("patient", "objective"),
      appPath("chat", "physiology"),
      appPath("chat", "objective-context"),
    ]) {
      expect(fs.existsSync(forbiddenRoute)).toBe(false);
    }
  });
});
