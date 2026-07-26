import fs from "fs";
import path from "path";

const FINAL_GATE_SCRIPT = "scripts/objective/phase3-final-release-gate.mjs";
const PHASE3_RELEASE_GATE_SCRIPT = "scripts/objective/phase3-release-gate.mjs";
const RELEASE_CHECKLIST =
    "docs/objective/phase3-validation/release-readiness-checklist.md";

const REQUIRED_FINAL_GATE_COMMANDS = [
    "corepack yarn test:phase1",
    "corepack yarn test:phase2",
    "corepack yarn test:phase3",
    "corepack yarn test:no-leaks",
    "corepack yarn lint",
    "corepack yarn typecheck",
    "corepack yarn build",
    "git diff --check",
] as const;

type FinalHardeningEvidence = {
    requirement: string;
    evidenceFiles: readonly string[];
    requiredMarkers: readonly string[];
};

const FINAL_HARDENING_EVIDENCE: readonly FinalHardeningEvidence[] = [
    {
        requirement: "patient objective access remains none",
        evidenceFiles: [
            "docs/objective/phase3-validation/rbac-rls-report.md",
            "frontend/__tests__/objective-dashboard/stage11DashboardRegression.test.ts",
            "services/objective-backend/__tests__/stage14RbacAccessRelease.test.ts",
        ],
        requiredMarkers: [
            "Patient | Denied from objective access",
            "objective_patient_denied",
        ],
    },
    {
        requirement: "chatbot objective access remains none",
        evidenceFiles: [
            "docs/objective/phase3-validation/rbac-rls-report.md",
            "docs/objective/phase3-validation/no-leak-report.md",
            "backend/src/retrieval_graph/__tests__/phase3NoLeakBoundaries.test.ts",
            "services/objective-backend/__tests__/noChatbotImports.test.ts",
        ],
        requiredMarkers: [
            "Chatbot | Denied from objective access",
            "chatbot prompt construction",
            "phase3NoLeakBoundaries",
        ],
    },
    {
        requirement: "assigned clinician access works",
        evidenceFiles: [
            "services/objective-backend/__tests__/stage14RbacAccessRelease.test.ts",
            "services/objective-backend/__tests__/streamStage10Security.test.ts",
        ],
        requiredMarkers: [
            "allows assigned clinician access",
            "allows assigned clinicians to subscribe",
        ],
    },
    {
        requirement: "simulator-to-dashboard works",
        evidenceFiles: [
            "services/objective-backend/__tests__/stage13SimulatorDashboardHappyPath.test.ts",
            "docs/objective/phase3-validation/simulator-scenario-coverage-matrix.md",
        ],
        requiredMarkers: [
            "Stage 13 simulator-to-dashboard happy-path E2E",
            "baseline_rest",
        ],
    },
    {
        requirement: "storage traceability works",
        evidenceFiles: [
            "services/objective-backend/__tests__/rawTraceabilityRoutes.test.ts",
            "services/objective-backend/__tests__/stage5BoundaryDrift.test.ts",
        ],
        requiredMarkers: [
            "rawTraceabilityRoutes",
            "raw-payload free",
        ],
    },
    {
        requirement: "unsafe labels are absent",
        evidenceFiles: [
            "services/objective-backend/__tests__/stage17FinalPhase3AcceptanceMatrix.test.ts",
            "packages/objective-safety/src/registries.ts",
            "packages/objective-safety/src/sourceScanner.ts",
        ],
        requiredMarkers: [
            "forbidden-label scan",
            "FORBIDDEN_OBJECTIVE_LABELS",
            "sourceScanner",
        ],
    },
    {
        requirement: "no clinical claims exist",
        evidenceFiles: [
            "docs/objective/phase3-validation/ml-model-card.md",
            "docs/objective/phase3-validation/calibration-note.md",
            "docs/objective/phase3-validation/release-readiness-checklist.md",
        ],
        requiredMarkers: [
            "not clinical validation",
            "not diagnostic",
            "does not establish clinical calibration",
        ],
    },
    {
        requirement: "objective-to-chatbot leakage is absent",
        evidenceFiles: [
            "docs/objective/phase3-validation/no-leak-report.md",
            "backend/src/retrieval_graph/__tests__/phase3ObjectiveToChatbotFullRegression.test.ts",
            "backend/src/retrieval_graph/__tests__/phase3ChatbotRedTeamFixtures.test.ts",
        ],
        requiredMarkers: [
            "PHASE3_OBJECTIVE_TO_CHATBOT_FULL_NO_LEAK_SENTINEL",
            "Objective data must never enter",
            "prompt injection",
        ],
    },
    {
        requirement: "dashboard wording is safe",
        evidenceFiles: [
            "docs/objective/phase3-validation/dashboard-safety-review-checklist.md",
            "frontend/__tests__/objective-dashboard/stage11AccessibilityAndCopy.test.ts",
            "frontend/__tests__/objective-dashboard/liveMonitoringCopy.test.ts",
        ],
        requiredMarkers: [
            "safe source-bound language",
            "not diagnostic",
            "clinician-reviewable",
        ],
    },
    {
        requirement: "audit logs are created",
        evidenceFiles: [
            "services/objective-backend/__tests__/stage14RbacAccessRelease.test.ts",
            "services/objective-backend/__tests__/audit.test.ts",
        ],
        requiredMarkers: [
            "createInMemoryObjectiveAuditLogger",
            "expectAuditRecordsAreSafe",
        ],
    },
    {
        requirement: "degraded states are safe",
        evidenceFiles: [
            "services/objective-backend/__tests__/stage13DegradedScenarios.test.ts",
            "docs/objective/phase3-validation/simulator-scenario-coverage-matrix.md",
        ],
        requiredMarkers: [
            "degradedCases",
            "expectNoUnsafeClinicianSurface",
            "signal_conflict",
        ],
    },
];

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

        if (parent === current) {
            break;
        }

        current = parent;
    }

    throw new Error(`Could not locate repo root from cwd: ${process.cwd()}`);
}

function readRepoFile(repoRoot: string, repoRelativePath: string): string {
    return fs.readFileSync(path.join(repoRoot, repoRelativePath), "utf8");
}

function expectRepoFileExists(repoRoot: string, repoRelativePath: string): void {
    const absolutePath = path.join(repoRoot, repoRelativePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Expected final hardening file: ${repoRelativePath}`);
    }
}

function combinedEvidence(
    repoRoot: string,
    evidence: FinalHardeningEvidence,
): string {
    return evidence.evidenceFiles
        .map(
            (evidenceFile) =>
                `${evidenceFile}\n${readRepoFile(repoRoot, evidenceFile)}`,
        )
        .join("\n");
}

describe("Stage 17 final integration hardening release gate", () => {
    it("adds a final release gate script and root package command", () => {
        const repoRoot = findRepoRoot();
        const packageJson = JSON.parse(
            readRepoFile(repoRoot, "package.json"),
        ) as {
            scripts: Record<string, string>;
        };

        expectRepoFileExists(repoRoot, FINAL_GATE_SCRIPT);
        expect(packageJson.scripts["test:phase3:final"]).toBe(
            "node scripts/objective/phase3-final-release-gate.mjs",
        );
    });

    it("runs the final release commands sequentially and keeps typecheck before build", () => {
        const repoRoot = findRepoRoot();
        const script = readRepoFile(repoRoot, FINAL_GATE_SCRIPT);

        for (const command of REQUIRED_FINAL_GATE_COMMANDS) {
            expect(script).toContain(`"${command}"`);
        }

        expect(script).toContain("for (const command of FINAL_GATE_COMMANDS)");
        expect(script).toContain("run(command)");
        expect(script).not.toContain("Promise.all");

        const typecheckIndex = script.indexOf('"corepack yarn typecheck"');
        const buildIndex = script.indexOf('"corepack yarn build"');

        expect(typecheckIndex).toBeGreaterThan(-1);
        expect(buildIndex).toBeGreaterThan(-1);
        expect(typecheckIndex).toBeLessThan(buildIndex);
    });

    it("keeps final acceptance, validation artifact, and hardening tests inside the Phase 3 gate", () => {
        const repoRoot = findRepoRoot();
        const gate = readRepoFile(repoRoot, PHASE3_RELEASE_GATE_SCRIPT);

        expect(gate).toContain("acceptance");
        expect(gate).toContain("stage17FinalPhase3AcceptanceMatrix.test.ts");
        expect(gate).toContain("stage17ValidationArtifacts.test.ts");
        expect(gate).toContain("stage17FinalIntegrationHardening.test.ts");
    });

    it("updates release readiness artifacts with the final gate command", () => {
        const repoRoot = findRepoRoot();
        const checklist = readRepoFile(repoRoot, RELEASE_CHECKLIST);

        expect(checklist).toContain("corepack yarn test:phase3:final");
        expect(checklist).toContain("Commit 75 final hardening");
        expect(checklist).toContain(
            "runs Phase 1, Phase 2, Phase 3, no-leak, lint, typecheck, build, and git diff checks sequentially",
        );
    });

    it("maps every final hardening requirement to concrete release evidence", () => {
        const repoRoot = findRepoRoot();

        expect(
            FINAL_HARDENING_EVIDENCE.map((evidence) => evidence.requirement),
        ).toEqual([
            "patient objective access remains none",
            "chatbot objective access remains none",
            "assigned clinician access works",
            "simulator-to-dashboard works",
            "storage traceability works",
            "unsafe labels are absent",
            "no clinical claims exist",
            "objective-to-chatbot leakage is absent",
            "dashboard wording is safe",
            "audit logs are created",
            "degraded states are safe",
        ]);

        for (const evidence of FINAL_HARDENING_EVIDENCE) {
            for (const evidenceFile of evidence.evidenceFiles) {
                expectRepoFileExists(repoRoot, evidenceFile);
            }

            const content = combinedEvidence(repoRoot, evidence);

            for (const marker of evidence.requiredMarkers) {
                expect(content).toContain(marker);
            }
        }
    });
});
