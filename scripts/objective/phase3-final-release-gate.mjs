#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const FINAL_GATE_COMMANDS = [
    "corepack yarn test:phase1",
    "corepack yarn test:phase2",
    "corepack yarn test:phase3",
    "corepack yarn test:no-leaks",
    "corepack yarn lint",
    "corepack yarn typecheck",
    "corepack yarn build",
    "git diff --check",
];

function run(command) {
    console.log(`\n[phase3-final-release-gate] ${command}`);

    const result = spawnSync(command, {
        stdio: "inherit",
        shell: true,
        env: process.env,
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

if (process.argv.includes("--list")) {
    console.log(FINAL_GATE_COMMANDS.join("\n"));
    process.exit(0);
}

for (const command of FINAL_GATE_COMMANDS) {
    run(command);
}
