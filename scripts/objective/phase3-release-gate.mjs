#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const TASKS = {
    simulator: [
        "yarn workspace @dad-chatbot/objective-simulator test",
    ],

    ingest: [
        [
            "yarn workspace @dad-chatbot/objective-backend test --",
            "rawIngestion.test.ts",
            "rawIngestionRoutes.test.ts",
            "rawStorage.test.ts",
            "rawTiming.test.ts",
            "rawTraceabilityRoutes.test.ts",
            "segmentManager.test.ts",
            "stage5IngestionClosure.test.ts",
            "stage5BoundaryDrift.test.ts",
            "stage14PerformanceBackpressure.test.ts",
        ].join(" "),
    ],

    features: [
        "yarn workspace @dad-chatbot/objective-preprocessing test",
        "yarn workspace @dad-chatbot/objective-backend test -- featureStorage.test.ts",
    ],

    ml: [
        "cd services/objective-ml && PYTHONPATH=. python3 -m unittest discover -s tests",
        [
            "yarn workspace @dad-chatbot/objective-backend test --",
            "mlInferenceClient.test.ts",
            "mlInferenceContract.test.ts",
            "mlInferenceRegressionSafety.test.ts",
            "mlInferenceStorage.test.ts",
        ].join(" "),
    ],

    interpretation: [
        "yarn workspace @dad-chatbot/objective-interpretation test",
        [
            "yarn workspace @dad-chatbot/objective-backend test --",
            "interpretationStorage.test.ts",
            "interpretationRegressionSafety.test.ts",
        ].join(" "),
    ],

    rbac: [
        [
            "yarn workspace @dad-chatbot/objective-backend test --",
            "auth.test.ts",
            "assignments.test.ts",
            "audit.test.ts",
            "failClosed.test.ts",
            "sessionLifecycle.test.ts",
            "sessionRoutes.test.ts",
            "sessionHistoryRoutes.test.ts",
            "sessionReplayRoutes.test.ts",
            "sessionSummaryRoutes.test.ts",
            "streamTokens.test.ts",
            "streamStage10Security.test.ts",
            "streamReconnectRevocation.test.ts",
            "stage12HistoryAccessRegression.test.ts",
            "stage14RbacAccessRelease.test.ts",
        ].join(" "),
    ],

    acceptance: [
        [
            "yarn workspace @dad-chatbot/objective-backend test --",
            "stage13SimulatorDashboardHappyPath.test.ts",
            "stage13DegradedScenarios.test.ts",
            "prototypeHardwareBridgeContract.test.ts",
            "prototypeHardwareBridgeSecurity.test.ts",
            "stage17FinalPhase3AcceptanceMatrix.test.ts",
        ].join(" "),
    ],

    dashboard: [
        "yarn workspace frontend test -- objective-dashboard --runInBand",
    ],

    safety: [
        "yarn workspace @dad-chatbot/objective-safety test",
        "yarn workspace @dad-chatbot/objective-schemas test",
        "yarn workspace @dad-chatbot/objective-safety typecheck",
        "yarn workspace @dad-chatbot/objective-schemas typecheck",
        "yarn workspace @dad-chatbot/objective-safety lint",
        "yarn workspace @dad-chatbot/objective-schemas lint",
    ],

    "no-leaks": [
        [
            "yarn workspace backend test --",
            "phase3NoLeakBoundaries.test.ts",
            "phase3ObjectiveToChatbotFullRegression.test.ts",
            "phase3ChatbotRedTeamFixtures.test.ts",
            "--runInBand",
        ].join(" "),
        "yarn workspace @dad-chatbot/objective-backend test -- noChatbotImports.test.ts",
    ],
};

const GROUPS = {
    objective: [
        "simulator",
        "ingest",
        "features",
        "ml",
        "interpretation",
        "rbac",
        "acceptance",
        "dashboard",
        "safety",
        "no-leaks",
    ],

    phase3: [
        "objective",
    ],
};

function commandsFor(taskName, seen = new Set()) {
    if (seen.has(taskName)) {
        throw new Error(`Circular Phase 3 release-gate task reference: ${taskName}`);
    }

    seen.add(taskName);

    if (TASKS[taskName]) {
        return TASKS[taskName];
    }

    const group = GROUPS[taskName];

    if (!group) {
        throw new Error(`Unknown Phase 3 release-gate task: ${taskName}`);
    }

    return group.flatMap((childTask) => commandsFor(childTask, new Set(seen)));
}

function run(command) {
    const runnableCommand = command.replace(/^yarn\b/, "corepack yarn");

    console.log(`\n[phase3-release-gate] ${runnableCommand}`);

    const result = spawnSync(runnableCommand, {
        stdio: "inherit",
        shell: true,
        env: process.env,
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

const taskName = process.argv[2];

if (!taskName) {
    console.error(
        [
            "Usage: node scripts/objective/phase3-release-gate.mjs <task>",
            "",
            "Tasks:",
            ...Object.keys(TASKS).map((task) => `  - ${task}`),
            ...Object.keys(GROUPS).map((task) => `  - ${task}`),
        ].join("\n"),
    );
    process.exit(1);
}

for (const command of commandsFor(taskName)) {
    run(command);
}
