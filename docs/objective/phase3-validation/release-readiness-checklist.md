# Phase 3 Release Readiness Checklist

Status: engineering/safety validation only, not clinical validation.

This artifact summarizes the Phase 3 release readiness position. It is not diagnostic and does not establish care-use validity.

Global visibility invariant:

- clinician_visible=true
- patient_visible=false
- chatbot_visible=false

## Required gates

Run these gates before considering Phase 3 complete:

- [ ] corepack yarn test:phase1
- [ ] corepack yarn test:phase2
- [ ] corepack yarn test:phase3
- [ ] corepack yarn test:phase3:final
- [ ] corepack yarn lint
- [ ] corepack yarn typecheck
- [ ] corepack yarn build
- [ ] git diff --check
- [ ] trailing-whitespace scan

## Phase 3 release areas

- [x] Chatbot safety freeze.
- [x] Objective no-leak boundaries.
- [x] Objective safety registries and schemas.
- [x] Database and RLS foundation.
- [x] Session lifecycle and raw ingestion.
- [x] Simulator package.
- [x] Preprocessing and feature windows.
- [x] ML service and backend inference contracts.
- [x] Safe interpretation mapping.
- [x] Clinician-only stream contracts.
- [x] Clinician dashboard static safety scaffold.
- [x] History, replay, summary, and notes boundaries.
- [x] Final acceptance scenario matrix.
- [x] Developer simulator panel gated by debug configuration.
- [x] Public dataset replay skeleton only.
- [x] Prototype hardware bridge disabled by default.

## Known limitations

- In-memory backend storage remains scaffold-level for many paths.
- Frontend dashboard sections remain mostly static safety scaffolds.
- Public dataset replay is a skeleton only.
- Prototype hardware ingestion is disabled by default.
- ML behavior is bounded engineering infrastructure, not clinical validation.
- Calibration is not clinical calibration.

## Commit 75 final hardening

The final integrated hardening command is:

- corepack yarn test:phase3:final

This command runs Phase 1, Phase 2, Phase 3, no-leak, lint, typecheck, build, and git diff checks sequentially.

## Release position

Phase 3 can be considered complete only after Commit 75 final hardening passes the full gate sequence above.
