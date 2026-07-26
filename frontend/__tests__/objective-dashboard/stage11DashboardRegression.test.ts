import fs from "fs";
import path from "path";
import {
  resolveObjectiveDashboardAccess,
  type ObjectiveDashboardAccessInput,
} from "../../app/(clinician)/clinician/objective/_lib/dashboardAccess";

const FRONTEND_ROOT = process.cwd();

function appPath(...segments: string[]): string {
  return path.join(FRONTEND_ROOT, "app", ...segments);
}

function repoRelative(filePath: string): string {
  return path.relative(FRONTEND_ROOT, filePath).split(path.sep).join("/");
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
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

function objectiveRouteRoot(): string {
  return appPath("(clinician)", "clinician", "objective");
}

function objectiveSourceFiles(): string[] {
  return collectFiles(objectiveRouteRoot()).filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );
}

function expectDenied(input: ObjectiveDashboardAccessInput, code: string): void {
  const access = resolveObjectiveDashboardAccess(input);

  expect(access.allowed).toBe(false);
  if (access.allowed) {
    throw new Error("Expected dashboard access to be denied");
  }

  expect(access.code).toBe(code);
}

function expectFileExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${repoRelative(filePath)}`);
  }
}

function expectPathMissing(filePath: string): void {
  if (fs.existsSync(filePath)) {
    throw new Error(`Expected path to be absent: ${repoRelative(filePath)}`);
  }
}

function expectNotMatching(
  content: string,
  pattern: RegExp,
  filePath: string,
): void {
  if (pattern.test(content)) {
    throw new Error(
      `Unexpected pattern ${pattern.toString()} in ${repoRelative(filePath)}`,
    );
  }
}

describe("Stage 11 clinician objective dashboard route and RBAC regressions", () => {
  it("keeps only the intended clinician objective route files", () => {
    const expectedRoutes = [
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
    ];

    for (const route of expectedRoutes) {
      expectFileExists(route);
    }
  });

  it("does not create patient, chatbot, or unsafe clinical dashboard routes", () => {
    const forbiddenRoutes = [
      appPath("patient", "objective"),
      appPath("chat", "physiology"),
      appPath("chat", "objective-context"),
      appPath("clinician", "relapse-risk"),
      appPath("clinician", "withdrawal-risk"),
      appPath("clinician", "intoxication"),
      appPath("clinician", "ciwa"),
    ];

    for (const forbiddenRoute of forbiddenRoutes) {
      expectPathMissing(forbiddenRoute);
    }
  });

  it("fails closed for missing, patient, chatbot, service, and developer roles", () => {
    expectDenied({}, "objective_dashboard_clinician_required");

    for (const role of ["patient", "chatbot", "service", "developer"] as const) {
      expectDenied(
        {
          role,
          actorId: `${role}-1`,
          assignmentStatus: "active",
          assignedPatientIds: ["patient-1"],
        },
        "objective_dashboard_clinician_required",
      );
    }
  });

  it("requires clinician identity, active assignment, and patient-specific assignment", () => {
    expectDenied(
      {
        role: "clinician",
        assignmentStatus: "active",
        assignedPatientIds: ["patient-1"],
      },
      "objective_dashboard_actor_required",
    );

    expectDenied(
      {
        role: "clinician",
        actorId: "clinician-1",
        assignmentStatus: "revoked",
        assignedPatientIds: ["patient-1"],
      },
      "objective_dashboard_assignment_required",
    );

    expectDenied(
      {
        role: "clinician",
        actorId: "clinician-1",
        assignmentStatus: "active",
        assignedPatientIds: ["patient-1"],
        requiredPatientId: "patient-2",
      },
      "objective_dashboard_patient_assignment_required",
    );

    const allowed = resolveObjectiveDashboardAccess({
      role: "clinician",
      actorId: "clinician-1",
      assignmentStatus: "active",
      assignedPatientIds: ["patient-1"],
      requiredPatientId: "patient-1",
    });

    expect(allowed.allowed).toBe(true);
  });

  it("does not import dashboard components from patient or chatbot app routes", () => {
    const appFiles = collectFiles(appPath()).filter((file) =>
      /\.(ts|tsx)$/.test(file),
    );

    const nonDashboardAppFiles = appFiles.filter((file) => {
      const normalized = repoRelative(file);
      return !normalized.startsWith("app/(clinician)/clinician/objective/");
    });

    for (const file of nonDashboardAppFiles) {
      const content = read(file);

      expectNotMatching(content, /\(clinician\)\/clinician\/objective/, file);
      expectNotMatching(content, /ObjectiveLiveMonitoringShell/, file);
      expectNotMatching(content, /ObjectiveRawSignalCharts/, file);
      expectNotMatching(content, /ObjectiveQualityFeatureCards/, file);
      expectNotMatching(content, /ObjectiveMlInterpretationCards/, file);
      expectNotMatching(content, /ObjectiveSessionTimelineSummaryNotes/, file);
    }
  });

  it("keeps dashboard code isolated from chatbot, LangGraph, safety, and subjective modules", () => {
    for (const file of objectiveSourceFiles()) {
      const content = read(file);

      expectNotMatching(content, /app\/api\/chat/, file);
      expectNotMatching(content, /langgraph/i, file);
      expectNotMatching(content, /retrieval_graph/, file);
      expectNotMatching(content, /finalGuard/, file);
      expectNotMatching(content, /subjective/, file);
      expectNotMatching(content, /backend\/src\/safety/, file);
    }
  });

  it("does not add frontend streaming clients, API fetches, or backend package coupling", () => {
    for (const file of objectiveSourceFiles()) {
      const content = read(file);

      expectNotMatching(content, /new\s+WebSocket/, file);
      expectNotMatching(content, /EventSource/, file);
      expectNotMatching(content, /text\/event-stream/, file);
      expectNotMatching(content, /server-sent/i, file);
      expectNotMatching(content, /\/api\/objective\/sessions\/.*\/stream/, file);
      expectNotMatching(content, /\bfetch\s*\(/, file);
      expectNotMatching(content, /services\/objective-backend/, file);
      expectNotMatching(content, /services\/objective-ml/, file);
      expectNotMatching(content, /packages\/objective-interpretation/, file);
    }
  });
});
