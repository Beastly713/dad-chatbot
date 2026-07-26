import fs from "fs";
import path from "path";

const ARTIFACT_ROOT = "docs/objective/phase3-validation";

type ValidationArtifact = {
    fileName: string;
    title: string;
    requiredMarkers: readonly string[];
};

const REQUIRED_ARTIFACTS: readonly ValidationArtifact[] = [
    {
        fileName: "simulator-scenario-coverage-matrix.md",
        title: "Phase 3 Simulator Scenario Coverage Matrix",
        requiredMarkers: [
            "baseline_rest",
            "elevated_arousal_pattern",
            "recovery_cooldown",
            "motion_artifact",
            "poor_contact",
            "sensor_dropout",
            "signal_conflict",
            "device_reset_or_timing_gap",
        ],
    },
    {
        fileName: "feature-validation-report.md",
        title: "Phase 3 Feature Validation Report",
        requiredMarkers: [
            "Feature validation covers",
            "baseline-relative features",
            "missingness",
            "Motion confound",
            "Feature windows are not standalone conclusions",
        ],
    },
    {
        fileName: "ml-model-card.md",
        title: "Phase 3 ML Model Card",
        requiredMarkers: [
            "baseline_relative_elevated_physiological_arousal_evidence",
            "Rule-safe stub behavior",
            "Dev-only classical pipeline artifacts",
            "one bounded input",
            "No standalone conclusion",
        ],
    },
    {
        fileName: "calibration-note.md",
        title: "Phase 3 Calibration Note",
        requiredMarkers: [
            "does not establish clinical calibration",
            "Baseline-relative feature calculation",
            "Suppression state",
            "Required future work",
        ],
    },
    {
        fileName: "dashboard-safety-review-checklist.md",
        title: "Phase 3 Dashboard Safety Review Checklist",
        requiredMarkers: [
            "Clinician-only route family",
            "Patient objective routes are absent",
            "Chatbot objective routes are absent",
            "Developer-only labels are isolated",
            "not diagnostic",
        ],
    },
    {
        fileName: "rbac-rls-report.md",
        title: "Phase 3 RBAC and RLS Report",
        requiredMarkers: [
            "Patient | Denied from objective access",
            "Chatbot | Denied from objective access",
            "Assigned-patient access only",
            "Database migrations define isolated objective schema tables",
        ],
    },
    {
        fileName: "red-team-report.md",
        title: "Phase 3 Red-Team Report",
        requiredMarkers: [
            "Detox advice requests",
            "Prompt injection",
            "Objective data leak attempts",
            "Patient and chatbot objective access remain denied",
        ],
    },
    {
        fileName: "no-leak-report.md",
        title: "Phase 3 No-Leak Report",
        requiredMarkers: [
            "chatbot prompt construction",
            "chatbot RAG retrieval",
            "LangGraph state",
            "frontend chat API",
            "parallel clinician-facing objective branch",
        ],
    },
    {
        fileName: "release-readiness-checklist.md",
        title: "Phase 3 Release Readiness Checklist",
        requiredMarkers: [
            "corepack yarn test:phase1",
            "corepack yarn test:phase2",
            "corepack yarn test:phase3",
            "Prototype hardware bridge disabled by default",
            "Commit 75 final hardening",
        ],
    },
];

const GLOBAL_REQUIRED_MARKERS = [
    "engineering/safety validation only",
    "not clinical validation",
    "not diagnostic",
    "clinician_visible=true",
    "patient_visible=false",
    "chatbot_visible=false",
] as const;

const FORBIDDEN_ARTIFACT_TERMS = [
    "raw_payload",
    "rawpayload",
    "raw_frame",
    "rawframe",
    "raw_frames",
    "rawframes",
    "ecg_raw",
    "gsr_raw",
    "max_red",
    "max_ir",
    "max_green",
    "accel_x",
    "accel_y",
    "accel_z",
    "gyro_x",
    "gyro_y",
    "gyro_z",
    "mpu_temp_c",
    "tmp117_temp_c",
    "craving_detected",
    "relapse_risk",
    "withdrawal_risk",
    "intoxication_detected",
    "aud_severity",
    "emergency_detected",
    "treatment_need",
    "detox_need",
    "medication_need",
    "ciwa_score",
    "sobriety_status",
    "patient_truthfulness",
    "patient_is_lying",
    "patient_is_safe",
    "patient_is_stable",
    "stress_proven",
    "risk score",
    "clinical alert",
    "emergency alert",
    "validated hardware",
    "clinical-grade",
    "medical device",
    "diagnostic device",
    "patient_visible=true",
    "chatbot_visible=true",
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

        if (parent === current) {
            break;
        }

        current = parent;
    }

    throw new Error(`Could not locate repo root from cwd: ${process.cwd()}`);
}

function artifactPath(repoRoot: string, artifact: ValidationArtifact): string {
    return path.join(repoRoot, ARTIFACT_ROOT, artifact.fileName);
}

function readArtifact(repoRoot: string, artifact: ValidationArtifact): string {
    return fs.readFileSync(artifactPath(repoRoot, artifact), "utf8");
}

function readRepoFile(repoRoot: string, repoRelativePath: string): string {
    return fs.readFileSync(path.join(repoRoot, repoRelativePath), "utf8");
}

function expectNoForbiddenArtifactTerms(
    artifact: ValidationArtifact,
    content: string,
): void {
    const normalized = content.toLowerCase();

    for (const forbidden of FORBIDDEN_ARTIFACT_TERMS) {
        if (normalized.includes(forbidden)) {
            throw new Error(
                `${artifact.fileName} unexpectedly contains forbidden term: ${forbidden}`,
            );
        }
    }
}

describe("Stage 17 validation artifacts and model-card preservation", () => {
    it("adds all required Phase 3 validation artifacts", () => {
        const repoRoot = findRepoRoot();

        expect(REQUIRED_ARTIFACTS.map((artifact) => artifact.fileName)).toEqual([
            "simulator-scenario-coverage-matrix.md",
            "feature-validation-report.md",
            "ml-model-card.md",
            "calibration-note.md",
            "dashboard-safety-review-checklist.md",
            "rbac-rls-report.md",
            "red-team-report.md",
            "no-leak-report.md",
            "release-readiness-checklist.md",
        ]);

        for (const artifact of REQUIRED_ARTIFACTS) {
            expect(fs.existsSync(artifactPath(repoRoot, artifact))).toBe(true);
        }
    });

    it("keeps every artifact explicit about engineering-only validation and visibility boundaries", () => {
        const repoRoot = findRepoRoot();

        for (const artifact of REQUIRED_ARTIFACTS) {
            const content = readArtifact(repoRoot, artifact);

            expect(content).toContain(`# ${artifact.title}`);

            for (const marker of GLOBAL_REQUIRED_MARKERS) {
                expect(content).toContain(marker);
            }

            for (const marker of artifact.requiredMarkers) {
                expect(content).toContain(marker);
            }

            expectNoForbiddenArtifactTerms(artifact, content);
        }
    });

    it("keeps artifact inventory aligned with the Stage 17 final acceptance matrix", () => {
        const repoRoot = findRepoRoot();
        const matrix = readRepoFile(
            repoRoot,
            "services/objective-backend/__tests__/stage17FinalPhase3AcceptanceMatrix.test.ts",
        );

        for (const marker of [
            "baseline session",
            "elevated arousal session",
            "recovery session",
            "motion confound",
            "dropout",
            "poor contact",
            "signal conflict",
            "ML unavailable",
            "dashboard reconnect",
            "revoked clinician access",
            "patient denial",
            "chatbot no-leak",
            "forbidden-label scan",
        ]) {
            expect(matrix).toContain(marker);
        }
    });

    it("keeps validation artifact scan wired into the Phase 3 release gate", () => {
        const repoRoot = findRepoRoot();
        const gate = readRepoFile(
            repoRoot,
            "scripts/objective/phase3-release-gate.mjs",
        );

        expect(gate).toContain("stage17FinalPhase3AcceptanceMatrix.test.ts");
        expect(gate).toContain("stage17ValidationArtifacts.test.ts");
    });
});
