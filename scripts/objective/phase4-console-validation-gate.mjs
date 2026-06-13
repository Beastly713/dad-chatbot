#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const COMMANDS = [
    {
        label: "Phase 4 objective-dashboard regression suite",
        command: "corepack",
        args: [
            "yarn",
            "workspace",
            "frontend",
            "test",
            "--",
            "objective-dashboard",
            "--runInBand",
        ],
    },
    {
        label: "Objective no-leak regression",
        command: "corepack",
        args: ["yarn", "test:no-leaks"],
    },
];

function runCommand({ label, command, args }) {
    console.log(`\n[phase4-console-gate] ${label}`);
    console.log(`[phase4-console-gate] $ ${command} ${args.join(" ")}`);

    const result = spawnSync(command, args, {
        stdio: "inherit",
        shell: false,
    });

    if (result.error) {
        console.error(
            `\n[phase4-console-gate] Failed to start command for: ${label}`,
        );
        console.error(result.error);
        process.exit(1);
    }

    if (result.status !== 0) {
        console.error(`\n[phase4-console-gate] Command failed for: ${label}`);
        process.exit(result.status ?? 1);
    }
}

console.log(
    "[phase4-console-gate] Starting Phase 4 objective console validation gate.",
);

for (const command of COMMANDS) {
    runCommand(command);
}

console.log(
    "\n[phase4-console-gate] Phase 4 objective console validation gate passed.",
);
