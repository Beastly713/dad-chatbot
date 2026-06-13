import fs from "fs";
import path from "path";

const REQUIRED_PHASE3_ACCEPTANCE_SCENARIOS = [
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
] as const;

type Phase3AcceptanceScenario =
    (typeof REQUIRED_PHASE3_ACCEPTANCE_SCENARIOS)[number];

type Phase3AcceptanceInvariant =
    | "clinician_only_visibility"
    | "patient_not_visible"
    | "chatbot_not_visible"
    | "source_bound_scope"
    | "degraded_safe"
    | "access_denial"
    | "chatbot_no_leak"
    | "forbidden_label_scan";

type Phase3AcceptanceMatrixRow = {
    scenario: Phase3AcceptanceScenario;
    evidenceFiles: readonly string[];
    requiredMarkers: readonly string[];
    invariants: readonly Phase3AcceptanceInvariant[];
};

const REQUIRED_BASE_INVARIANTS = [
    "clinician_only_visibility",
    "patient_not_visible",
    "chatbot_not_visible",
    "source_bound_scope",
] as const satisfies readonly Phase3AcceptanceInvariant[];

const FINAL_PHASE3_ACCEPTANCE_MATRIX: readonly Phase3AcceptanceMatrixRow[] = [
    {
        scenario: "baseline session",
        evidenceFiles: [
            "packages/objective-simulator/src/scenarios.ts",
            "packages/objective-simulator/__tests__/scenarios.test.ts",
            "services/objective-backend/__tests__/stage13SimulatorDashboardHappyPath.test.ts",
        ],
        requiredMarkers: [
            "baseline_rest",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS],
    },
    {
        scenario: "elevated arousal session",
        evidenceFiles: [
            "packages/objective-simulator/src/scenarios.ts",
            "services/objective-backend/__tests__/stage13SimulatorDashboardHappyPath.test.ts",
            "packages/objective-interpretation/__tests__/mapper.test.ts",
        ],
        requiredMarkers: [
            "elevated_arousal_pattern",
            "elevated_arousal_evidence",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS],
    },
    {
        scenario: "recovery session",
        evidenceFiles: [
            "packages/objective-simulator/src/scenarios.ts",
            "services/objective-backend/__tests__/stage13SimulatorDashboardHappyPath.test.ts",
            "packages/objective-interpretation/__tests__/mapper.test.ts",
        ],
        requiredMarkers: [
            "recovery_cooldown",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS],
    },
    {
        scenario: "motion confound",
        evidenceFiles: [
            "packages/objective-simulator/src/scenarios.ts",
            "services/objective-backend/__tests__/stage13DegradedScenarios.test.ts",
            "packages/objective-preprocessing/__tests__/crossSignalFeatures.test.ts",
        ],
        requiredMarkers: [
            "motion_artifact",
            "motion artifact",
            "motion_confound",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS, "degraded_safe"],
    },
    {
        scenario: "dropout",
        evidenceFiles: [
            "packages/objective-simulator/src/scenarios.ts",
            "services/objective-backend/__tests__/stage13DegradedScenarios.test.ts",
            "packages/objective-simulator/__tests__/injections.test.ts",
        ],
        requiredMarkers: [
            "sensor_dropout",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS, "degraded_safe"],
    },
    {
        scenario: "poor contact",
        evidenceFiles: [
            "packages/objective-simulator/src/scenarios.ts",
            "services/objective-backend/__tests__/stage13DegradedScenarios.test.ts",
            "packages/objective-preprocessing/__tests__/stage7GoldenFeatureWindows.test.ts",
        ],
        requiredMarkers: [
            "poor_contact",
            "signal_quality_limitation",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS, "degraded_safe"],
    },
    {
        scenario: "signal conflict",
        evidenceFiles: [
            "packages/objective-simulator/src/scenarios.ts",
            "services/objective-backend/__tests__/stage13DegradedScenarios.test.ts",
            "packages/objective-preprocessing/__tests__/crossSignalFeatures.test.ts",
        ],
        requiredMarkers: [
            "signal_conflict",
            "cross_signal",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS, "degraded_safe"],
    },
    {
        scenario: "ML unavailable",
        evidenceFiles: [
            "services/objective-backend/__tests__/stage13DegradedScenarios.test.ts",
            "services/objective-backend/__tests__/mlInferenceClient.test.ts",
            "services/objective-ml/tests/test_server.py",
        ],
        requiredMarkers: [
            "unavailable",
            "insufficient_reliable_data",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS, "degraded_safe"],
    },
    {
        scenario: "dashboard reconnect",
        evidenceFiles: [
            "services/objective-backend/__tests__/streamReconnectRevocation.test.ts",
            "services/objective-backend/__tests__/streamStage10Security.test.ts",
            "services/objective-backend/__tests__/stage14PerformanceBackpressure.test.ts",
        ],
        requiredMarkers: [
            "reconnect",
            "replay=latest",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS],
    },
    {
        scenario: "revoked clinician access",
        evidenceFiles: [
            "services/objective-backend/__tests__/streamReconnectRevocation.test.ts",
            "services/objective-backend/__tests__/stage14RbacAccessRelease.test.ts",
        ],
        requiredMarkers: [
            "assignment_revoked_after_connect",
            "revoked",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS, "access_denial"],
    },
    {
        scenario: "patient denial",
        evidenceFiles: [
            "services/objective-backend/__tests__/stage14RbacAccessRelease.test.ts",
            "services/objective-backend/__tests__/rawIngestionRoutes.test.ts",
            "frontend/__tests__/objective-dashboard/stage11DashboardRegression.test.ts",
        ],
        requiredMarkers: [
            "objective_patient_denied",
            "patient",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [...REQUIRED_BASE_INVARIANTS, "access_denial"],
    },
    {
        scenario: "chatbot no-leak",
        evidenceFiles: [
            "backend/src/retrieval_graph/__tests__/phase3ObjectiveToChatbotFullRegression.test.ts",
            "backend/src/retrieval_graph/__tests__/phase3NoLeakBoundaries.test.ts",
            "backend/src/retrieval_graph/__tests__/phase3ChatbotRedTeamFixtures.test.ts",
            "services/objective-backend/__tests__/noChatbotImports.test.ts",
            "services/objective-backend/__tests__/stage14RbacAccessRelease.test.ts",
        ],
        requiredMarkers: [
            "PHASE3_OBJECTIVE_TO_CHATBOT_FULL_NO_LEAK_SENTINEL",
            "chatbot",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [
            ...REQUIRED_BASE_INVARIANTS,
            "access_denial",
            "chatbot_no_leak",
        ],
    },
    {
        scenario: "forbidden-label scan",
        evidenceFiles: [
            "packages/objective-safety/src/registries.ts",
            "packages/objective-safety/src/scanner.ts",
            "packages/objective-safety/src/sourceScanner.ts",
            "services/objective-backend/__tests__/prototypeHardwareBridgeContract.test.ts",
            "services/objective-backend/__tests__/prototypeHardwareBridgeSecurity.test.ts",
        ],
        requiredMarkers: [
            "FORBIDDEN_OBJECTIVE_LABELS",
            "findForbiddenObjectiveTermViolations",
            "clinician_visible",
            "patient_visible",
            "chatbot_visible",
        ],
        invariants: [
            ...REQUIRED_BASE_INVARIANTS,
            "access_denial",
            "forbidden_label_scan",
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
        throw new Error(`Expected acceptance evidence file: ${repoRelativePath}`);
    }
}

function combinedEvidence(repoRoot: string, row: Phase3AcceptanceMatrixRow): string {
    return row.evidenceFiles
        .map((evidenceFile) => readRepoFile(repoRoot, evidenceFile))
        .join("\n");
}

function expectNoUnsafeMatrixTerms(value: unknown): void {
    const serialized = JSON.stringify(value).toLowerCase();

    for (const forbidden of [
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
        "synthetic_ground_truth",
        "ground_truth",
        "clinical alert",
        "emergency alert",
        "risk score",
        "validated hardware",
        "clinical-grade",
        "medical device",
        "diagnostic device",
        "care device",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

describe("Stage 17 final Phase 3 acceptance scenario matrix", () => {
    it("contains exactly the required final acceptance rows", () => {
        expect(FINAL_PHASE3_ACCEPTANCE_MATRIX.map((row) => row.scenario)).toEqual(
            REQUIRED_PHASE3_ACCEPTANCE_SCENARIOS,
        );

        expect(new Set(FINAL_PHASE3_ACCEPTANCE_MATRIX.map((row) => row.scenario)).size)
            .toBe(REQUIRED_PHASE3_ACCEPTANCE_SCENARIOS.length);

        expectNoUnsafeMatrixTerms(FINAL_PHASE3_ACCEPTANCE_MATRIX);
    });

    it("maps every acceptance row to concrete repository evidence files", () => {
        const repoRoot = findRepoRoot();

        for (const row of FINAL_PHASE3_ACCEPTANCE_MATRIX) {
            expect(row.evidenceFiles.length).toBeGreaterThan(0);

            for (const evidenceFile of row.evidenceFiles) {
                expectRepoFileExists(repoRoot, evidenceFile);
            }
        }
    });

    it("keeps every acceptance row tied to existing tested markers", () => {
        const repoRoot = findRepoRoot();

        for (const row of FINAL_PHASE3_ACCEPTANCE_MATRIX) {
            const evidence = combinedEvidence(repoRoot, row);

            for (const marker of row.requiredMarkers) {
                expect(evidence).toContain(marker);
            }
        }
    });

    it("keeps every acceptance row clinician-only, patient-hidden, chatbot-hidden, and source-bound", () => {
        for (const row of FINAL_PHASE3_ACCEPTANCE_MATRIX) {
            for (const invariant of REQUIRED_BASE_INVARIANTS) {
                expect(row.invariants).toContain(invariant);
            }
        }
    });

    it("keeps degraded, access-denial, chatbot, and scan rows explicitly labeled", () => {
        function rowFor(
            scenario: Phase3AcceptanceScenario,
        ): Phase3AcceptanceMatrixRow {
            const row = FINAL_PHASE3_ACCEPTANCE_MATRIX.find(
                (candidate) => candidate.scenario === scenario,
            );

            if (!row) {
                throw new Error(`Missing final acceptance row: ${scenario}`);
            }

            return row;
        }

        for (const scenario of [
            "motion confound",
            "dropout",
            "poor contact",
            "signal conflict",
            "ML unavailable",
        ] as const) {
            expect(rowFor(scenario).invariants).toContain("degraded_safe");
        }

        for (const scenario of [
            "revoked clinician access",
            "patient denial",
            "chatbot no-leak",
            "forbidden-label scan",
        ] as const) {
            expect(rowFor(scenario).invariants).toContain("access_denial");
        }

        expect(rowFor("chatbot no-leak").invariants).toContain("chatbot_no_leak");
        expect(rowFor("forbidden-label scan").invariants).toContain(
            "forbidden_label_scan",
        );
    });

    it("keeps the final acceptance matrix wired into the Phase 3 release gate", () => {
        const repoRoot = findRepoRoot();
        const gate = readRepoFile(
            repoRoot,
            "scripts/objective/phase3-release-gate.mjs",
        );

        expect(gate).toContain("acceptance");
        expect(gate).toContain("stage13SimulatorDashboardHappyPath.test.ts");
        expect(gate).toContain("stage13DegradedScenarios.test.ts");
        expect(gate).toContain("prototypeHardwareBridgeContract.test.ts");
        expect(gate).toContain("prototypeHardwareBridgeSecurity.test.ts");
        expect(gate).toContain("stage17FinalPhase3AcceptanceMatrix.test.ts");
    });
});
