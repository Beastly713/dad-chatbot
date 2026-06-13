# Current Project State

Last updated: 2026-06-13 18:55:05 IST
Branch: objective-monitoring
Latest commit: d477d1d docs(project): add current project state anchor
Final Phase 3 implementation commit: b3cb125 chore(phase3): add final integration hardening release gate
Worktree status: clean before this edit

## 1. Project purpose

This repository is a safe alcohol-SUD support chatbot system with three completed engineering phases on the current branch:

- Phase 1: safety-bounded alcohol support chatbot.
- Phase 2: subjective alcohol check-in branch for safe-support conversations.
- Phase 3: clinician-only objective physiological monitoring branch.

The project is not a diagnostic system, not a medication/detox/treatment planner, and not an emergency detector. Objective data is treated as source-bound, uncertainty-bearing, clinician-reviewable evidence only. Patient-facing chatbot behavior remains separated from objective monitoring.

## 2. Current high-level architecture

- `backend/`: LangGraph chatbot, safety triage, final guard, curated alcohol KB, subjective check-in logic, and chatbot no-leak tests.
- `frontend/`: chat frontend plus clinician objective dashboard scaffolding and dev simulator panel route files.
- `packages/objective-safety`: allowed/forbidden objective terminology registries and forbidden-term scanners.
- `packages/objective-schemas`: raw sensor, batch, visibility, session metadata, derived record schemas.
- `packages/objective-simulator`: simulator scenario profiles, timelines, raw generators, injections, CSV replay/export, streamer, CLI, and public dataset replay skeleton.
- `packages/objective-preprocessing`: windowing, ECG/GSR/PPG/IMU/temperature feature extraction, baseline, and cross-signal features.
- `packages/objective-interpretation`: evidence/confidence mapper and safe clinician summary templates.
- `services/objective-backend`: dedicated objective backend service with in-memory repositories, auth/assignment guards, ingestion, raw storage, feature/ML/interpretation storage, stream routes, history/replay/summary routes, audit, and hardware bridge contract.
- `services/objective-ml`: Python ML service scaffold, rule-safe stub, dev-only classical model pipeline, vectorizer, artifacts, and tests.
- `supabase/migrations`: static objective SQL/RLS/view/audit/schema migrations with static test coverage.
- `scripts/objective`: Phase 3 release gates and final hardening gate.
- `docs/objective/phase3-validation`: validation reports, model card, calibration note, no-leak report, RBAC/RLS report, and release checklist.

## 3. Phase 1: Safe alcohol-SUD chatbot

### Implemented

- Deterministic safety triage in `backend/src/safety/triage.ts`.
- Safety policies and template selection in `backend/src/safety/policies.ts` and `backend/src/safety/templates.ts`.
- Template-only handling for high-risk categories such as self-harm/immediate danger, possible medical emergency, withdrawal/detox concern, medication dosage request, unsafe alcohol requests, and policy bypass.
- RAG is limited to safe support categories through KB filters in `backend/src/kb/filters.ts`.
- Curated alcohol KB seed documents exist in `backend/src/kb/seed/alcoholPhase1.ts`.
- `finalGuard` runs before outputs in the retrieval graph and blocks unsafe clinical, detox, medication, diagnosis, and policy-leak language.

### Safety boundaries

- No diagnosis.
- No medication dosage advice.
- No detox instructions.
- No CIWA or clinical scoring guidance.
- No country-specific hotline logic was verified in the inspected Phase 1 files.
- High-risk paths use deterministic templates rather than generated advice.

### Important files

- `backend/src/safety/triage.ts`
- `backend/src/safety/finalGuard.ts`
- `backend/src/safety/policies.ts`
- `backend/src/safety/templates.ts`
- `backend/src/retrieval_graph/graph.ts`
- `backend/src/retrieval_graph/prompts.ts`
- `backend/src/kb/seed/alcoholPhase1.ts`
- `backend/src/kb/filters.ts`
- `backend/src/safety/__tests__/phase1Acceptance.test.ts`
- `backend/src/retrieval_graph/__tests__/phase1Graph.test.ts`
- `backend/src/retrieval_graph/__tests__/phase1GraphInvariants.test.ts`

### Current validation

- Root script: `corepack yarn test:phase1`
- Phase 1 and Phase 2 safety tests are also included in `corepack yarn test:phase2`.

## 4. Phase 2: Subjective check-in layer

### Implemented

- Alcohol-only subjective state and adapter files under `backend/src/subjective`.
- Deterministic extractor, reducer, planner, controller, freshness utilities, and questions.
- Red-flag subflags in `backend/src/safety/subflags.ts`.
- Subjective check-in routing inside `backend/src/retrieval_graph/graph.ts`.
- Subjective state can escalate danger through safety subflags.

### Safety boundaries

- Subjective state can escalate but must not downgrade an already dangerous category.
- No clinical scoring.
- No objective physiological data is accepted into subjective reducer/planner/controller outputs.
- The adapter is alcohol-scoped; no second substance adapter was verified.

### Important files

- `backend/src/subjective/types.ts`
- `backend/src/subjective/extractor.ts`
- `backend/src/subjective/reducer.ts`
- `backend/src/subjective/planner.ts`
- `backend/src/subjective/controller.ts`
- `backend/src/subjective/substances/alcohol.ts`
- `backend/src/safety/subflags.ts`
- `backend/src/subjective/__tests__/phase2Acceptance.test.ts`
- `backend/src/retrieval_graph/__tests__/phase2Graph.test.ts`
- `backend/src/retrieval_graph/__tests__/phase2SafetyInvariants.test.ts`

### Current validation

- Root script: `corepack yarn test:phase2`

## 5. Phase 3: Objective physiological monitoring layer

### Current status

Phase 3 is complete through Commit 75 in the inspected repository.

Completion marker:

- Phase 3 blueprint status: 75/75 planned commits complete.
- Final verified Phase 3 implementation commit: `b3cb125 chore(phase3): add final integration hardening release gate`.
- Current branch: `objective-monitoring`.
- Current latest commit at this checkpoint: `d477d1d docs(project): add current project state anchor`.

Evidence:

- `docs/objective/phase3-validation/release-readiness-checklist.md` marks Phase 3 release areas complete and names Commit 75 final hardening.
- `scripts/objective/phase3-final-release-gate.mjs` exists and runs Phase 1, Phase 2, Phase 3, no-leak, lint, typecheck, build, and `git diff --check` sequentially.
- `services/objective-backend/__tests__/stage17FinalIntegrationHardening.test.ts` exists and verifies final gate coverage and release evidence.

Final reported validation/gates passed for Commit 75:

- `corepack yarn test:phase1`
- `corepack yarn test:phase2`
- `corepack yarn test:phase3`
- `corepack yarn test:no-leaks`
- `corepack yarn lint`
- `corepack yarn typecheck`
- `corepack yarn build`
- `git diff --check`

### Implemented subsystems

- Chatbot freeze/no-leak protection.
- Objective safety package and scanners.
- Objective schemas.
- Static database/RLS/audit/view migration foundation.
- Dedicated objective backend service.
- Auth, assignment, visibility, and fail-closed guards.
- Audit logger with bounded metadata.
- Session lifecycle.
- Raw ingestion, timing validation, segment manager, raw chunk storage, quarantine, and traceability.
- Simulator package with profiles, timelines, raw generators, injections, CSV, streamer, CLI, and public dataset replay skeleton.
- Preprocessing and feature windows.
- ECG, GSR, PPG, IMU, and temperature technical features.
- Baseline-relative and cross-signal features.
- Python ML service scaffold, safe stub, dev-only classical ML pipeline, artifacts, and backend ML client/storage.
- Interpretation package, confidence/evidence mapping, safe summaries, and interpretation storage.
- Clinician-only stream tokens, WebSocket stream route, reconnect/replay, and assignment revocation behavior.
- Clinician objective dashboard scaffolding and tests.
- History, replay, summary, and note boundaries.
- Gated developer simulator panel.
- Disabled prototype hardware bridge contract.
- Final acceptance matrix, validation artifacts/model card docs, and final integration hardening release gate.

### Data flow

```text
Simulator / prototype source
  |
  v
Raw sensor frames
  |
  v
Raw ingestion validation
  |
  v
Raw storage / traceability
  |
  v
Session lifecycle and segmentation
  |
  v
Preprocessing windows
  |
  v
Feature extraction
  |
  v
Baseline-relative features
  |
  v
ML inference
  |
  v
Safe interpretation/confidence layer
  |
  v
Clinician-only stream/dashboard-safe surfaces
  |
  v
History list/detail
  |
  v
Historical replay
  |
  v
Final session summary
```

### Safety boundaries

- Objective branch is clinician-only.
- Patients and chatbot roles are explicitly denied by objective auth guards.
- Objective data must not enter chatbot graph, prompts, RAG, memory, final guard, triage, subjective state, or patient-facing API responses.
- Raw physiological values are stored only in raw storage contexts and must not appear in clinician-safe traceability, stream, history, dashboard-safe, audit, chatbot, or patient surfaces.
- Objective outputs are source-bound and not diagnostic.

### Important files

- `packages/objective-safety/src/registries.ts`
- `packages/objective-schemas/src/*`
- `services/objective-backend/src/*`
- `packages/objective-simulator/src/*`
- `packages/objective-preprocessing/src/*`
- `services/objective-ml/objective_ml/*`
- `packages/objective-interpretation/src/*`
- `frontend/app/(clinician)/clinician/objective/*`
- `frontend/app/dev/objective-simulator/*`
- `docs/objective/phase3-validation/*`
- `scripts/objective/phase3-release-gate.mjs`
- `scripts/objective/phase3-final-release-gate.mjs`

### Current validation

- Root Phase 3 gate: `corepack yarn test:phase3`
- No-leak gate: `corepack yarn test:no-leaks`
- Final hardening gate: `corepack yarn test:phase3:final`
- Final hardening test: `services/objective-backend/__tests__/stage17FinalIntegrationHardening.test.ts`

## 6. Objective monitoring implementation details

### 6.1 Objective safety and schemas

Implemented:

- Allowed ML target, ML classes, interpretation labels, evidence levels, confidence labels, and source types in `packages/objective-safety/src/registries.ts`.
- Forbidden labels, field names, and route segments in the safety registry.
- Scanner and source scanner packages.
- Raw sensor frame, raw batch, visibility, session metadata, and derived record schemas in `packages/objective-schemas/src`.

Current validation:

- `packages/objective-safety/__tests__/*`
- `packages/objective-schemas/__tests__/*`
- Included in `corepack yarn test:objective:safety` and `corepack yarn test:phase3`.

### 6.2 Database/RLS foundation

Implemented and statically tested:

- Objective schema/enums migration.
- Metadata tables.
- Raw storage tables.
- Feature/baseline tables.
- ML registry/inference tables.
- Interpretation/summary/note tables.
- Audit/assignment tables.
- RLS and clinician-safe views.

Files:

- `supabase/migrations/20260602000100_objective_schema_enums.sql`
- `supabase/migrations/20260602000200_objective_metadata_tables.sql`
- `supabase/migrations/20260602000300_objective_raw_storage_tables.sql`
- `supabase/migrations/20260602000400_objective_feature_baseline_tables.sql`
- `supabase/migrations/20260602000500_objective_ml_registry_tables.sql`
- `supabase/migrations/20260602000600_objective_interpretation_summary_note_tables.sql`
- `supabase/migrations/20260602000700_objective_audit_assignment_tables.sql`
- `supabase/migrations/20260602000800_objective_rls_views.sql`

Limit: tests are static SQL tests; no live Supabase execution harness was verified.

### 6.3 Objective backend

Implemented:

- Dedicated service package `services/objective-backend`.
- Config, health, server routing, trace context, safe error bodies.
- Auth, assignments, visibility, fail-closed helpers.
- In-memory repositories for many paths.
- Audit logger.
- Session lifecycle and routes.
- Raw ingestion, raw storage, timing, segment manager, traceability.
- Feature, ML inference, and interpretation storage.
- Stream token, event, and WebSocket route support.
- History, replay, summary route handlers.
- Disabled prototype hardware bridge contract.

Important files:

- `services/objective-backend/src/server.ts`
- `services/objective-backend/src/auth.ts`
- `services/objective-backend/src/assignments.ts`
- `services/objective-backend/src/audit.ts`
- `services/objective-backend/src/sessionLifecycle.ts`
- `services/objective-backend/src/rawIngestion.ts`
- `services/objective-backend/src/rawStorage.ts`
- `services/objective-backend/src/streamRoutes.ts`
- `services/objective-backend/src/sessionHistoryRoutes.ts`

### 6.4 Raw ingestion and traceability

Implemented:

- Canonical service-only batch ingestion endpoint.
- Session-scoped ingestion alias.
- Frame validation and quarantining.
- Timing analysis and chunk partitioning.
- Segment creation for session start, timing gap, and device reset contexts.
- Raw batch/chunk/quarantine storage.
- Clinician-safe chunk traceability.
- Quarantine summary without raw reject details or raw field values.

Scaffold/in-memory:

- Current backend repositories are primarily in-memory implementations in the inspected source.

### 6.5 Simulator

Implemented:

- Scenario profiles and timeline generator.
- Raw ECG/GSR/PPG/IMU/temperature-like generators.
- Motion artifact, poor contact, dropout, timing gap, device reset, and signal conflict injection support.
- CSV export/replay helpers.
- REST streamer and CLI entrypoint.
- Public dataset replay skeleton.

Not implemented:

- Public dataset replay does not bundle, download, or parse datasets. It is skeleton-only.

### 6.6 Preprocessing and features

Implemented:

- Raw batch flattening and feature-window foundations.
- Per-modality buffers and missingness/availability.
- ECG and GSR technical features.
- PPG, IMU, and temperature technical features.
- Baseline manager.
- Baseline-relative feature fields.
- Cross-signal agreement/disagreement and motion confound indicators.

Safety boundary:

- Feature extraction produces technical, clinician-only features and avoids clinical labels or model outputs.

### 6.7 ML service and ML inference

Implemented:

- Python service scaffold in `services/objective-ml/objective_ml/server.py`.
- Contract definitions.
- Rule-safe model stub.
- Vectorizer.
- Dev-only classical model pipeline.
- JSON artifacts including model registry and model cards.
- Backend ML inference client, contract, and storage.

Limit:

- ML is bounded engineering infrastructure and not clinically validated.
- Calibration docs exist, but no clinical calibration is claimed.

### 6.8 Interpretation/confidence layer

Implemented:

- Objective interpretation package with mapper and summary templates.
- Evidence/confidence/uncertainty mapping.
- Safe deterministic clinician summary templates.
- Backend interpretation persistence and regression safety tests.

Safety boundary:

- High model probability alone does not create clinical certainty.
- Suppression/uncertainty states are preserved for poor quality, missing baseline, motion confounds, conflicts, and unavailable ML.

### 6.9 Streaming

Implemented:

- Clinician stream token generation/validation.
- WebSocket upgrade route at `/api/objective/sessions/:sessionId/stream`.
- Event filtering by granted scopes.
- Latest-state replay behavior.
- Assignment revocation handling.
- Stream no-leak tests and security tests.

Safety boundary:

- Stream events are clinician-only and must not include raw sensor field names, raw payloads, developer-only labels, or synthetic ground truth.

### 6.10 History, replay, summaries, notes

Implemented:

- History list and detail routes.
- Historical replay route.
- Final session summary route.
- Session timeline, summaries, and clinician notes dashboard scaffolding/tests.

Scaffold/in-memory:

- Default history/replay/summary repositories are built from in-memory session state and empty feature/interpretation/ML repositories unless injected by tests or callers.

### 6.11 Developer/dataset/hardware skeletons

Implemented:

- Developer simulator panel route and config files under `frontend/app/dev/objective-simulator`.
- Public dataset replay skeleton in `packages/objective-simulator/src/publicDatasetReplay.ts`.
- Prototype hardware bridge contract in `services/objective-backend/src/prototypeHardwareBridge.ts`.

Not implemented / disabled:

- Public dataset replay is preparation-only and does not fetch or bundle dataset files.
- Prototype hardware ingestion is disabled by default.
- Prototype hardware transports are marked disabled in the bridge config.
- No validated hardware or clinical device-readiness claim exists.

### 6.12 Final acceptance and release gates

Implemented:

- `scripts/objective/phase3-release-gate.mjs`
- `scripts/objective/phase3-final-release-gate.mjs`
- `services/objective-backend/__tests__/stage17FinalPhase3AcceptanceMatrix.test.ts`
- `services/objective-backend/__tests__/stage17ValidationArtifacts.test.ts`
- `services/objective-backend/__tests__/stage17FinalIntegrationHardening.test.ts`
- Validation artifacts in `docs/objective/phase3-validation`.

Final Stage 17 acceptance matrix scenarios:

- baseline session
- elevated arousal session
- recovery session
- motion confound
- dropout
- poor contact
- signal conflict
- ML unavailable
- dashboard reconnect
- revoked clinician access
- patient denial
- chatbot no-leak
- forbidden-label scan

Required Phase 3 validation artifact files:

- `docs/objective/phase3-validation/simulator-scenario-coverage-matrix.md`
- `docs/objective/phase3-validation/feature-validation-report.md`
- `docs/objective/phase3-validation/ml-model-card.md`
- `docs/objective/phase3-validation/calibration-note.md`
- `docs/objective/phase3-validation/dashboard-safety-review-checklist.md`
- `docs/objective/phase3-validation/rbac-rls-report.md`
- `docs/objective/phase3-validation/red-team-report.md`
- `docs/objective/phase3-validation/no-leak-report.md`
- `docs/objective/phase3-validation/release-readiness-checklist.md`

Final gate:

```bash
corepack yarn test:phase3:final
```

The final gate runs the following commands sequentially as verified in the script:

```bash
corepack yarn test:phase1
corepack yarn test:phase2
corepack yarn test:phase3
corepack yarn test:no-leaks
corepack yarn lint
corepack yarn typecheck
corepack yarn build
git diff --check
```

## 7. Current endpoint inventory

Confirmed from objective backend route source files:

```text
GET /health
GET /api/objective/health

POST /api/objective/sessions
POST /api/objective/sessions/:sessionId/start
POST /api/objective/sessions/:sessionId/pause
POST /api/objective/sessions/:sessionId/resume
POST /api/objective/sessions/:sessionId/stop
GET /api/objective/sessions/:sessionId/status

POST /api/objective/ingest/batch
POST /api/objective/sessions/:sessionId/ingest

GET /api/objective/sessions/:sessionId/raw/traceability
GET /api/objective/sessions/:sessionId/raw/quarantine-summary

GET /api/objective/history/patients/:patientId/sessions
GET /api/objective/history/sessions/:sessionId
GET /api/objective/history/sessions/:sessionId/replay
GET /api/objective/history/sessions/:sessionId/summary

WebSocket:
GET /api/objective/sessions/:sessionId/stream?token=...
```

## 8. Current route/surface inventory

Frontend objective files verified:

- Clinician objective route group under `frontend/app/(clinician)/clinician/objective`.
- Clinician pages:
  - `/clinician/objective`
  - `/clinician/objective/live/[sessionId]`
  - `/clinician/objective/patients`
  - `/clinician/objective/patients/[patientId]/sessions`
  - `/clinician/objective/sessions/[sessionId]`
- Developer simulator page:
  - `/dev/objective-simulator`
- Objective dashboard tests under `frontend/__tests__/objective-dashboard`.

No patient objective route was verified. Chatbot objective routes are explicitly guarded by no-leak tests as absent.

## 9. Role/access behavior

Patient:

- Explicitly denied by `parseObjectiveActorFromHeaders`.
- No verified patient objective dashboard/API surface.
- Objective data must not appear in patient-facing chatbot responses.

Chatbot:

- Explicitly denied by `parseObjectiveActorFromHeaders`.
- No objective access.
- Objective data must not enter LangGraph, RAG, memory, finalGuard, triage, subjective state, or chatbot API response payloads.

Clinician:

- Assigned-patient access only.
- Can access clinician-safe objective session status, history, replay, summary, traceability, and stream surfaces only when assignment checks pass.

Service:

- Used for simulator/service producer behavior.
- Raw ingestion is service-only in the ingestion implementation and tests.
- Service can create source sessions where route/guard logic permits it.
- Service must not be treated as a clinician history, replay, summary, traceability, or dashboard reader unless a future route explicitly implements that behavior.

Developer:

- Developer tooling exists for simulator/debug paths.
- Prototype hardware bridge access is debug/contract scoped and disabled by default.
- Developer access is not ordinary patient/clinician objective data access unless explicitly implemented later.
- Developer simulator and hardware paths are non-production tooling paths and must remain gated.

## 10. Validation commands

Current root scripts and release gates include:

```bash
corepack yarn test:phase1
corepack yarn test:phase2
corepack yarn test:phase3
corepack yarn test:no-leaks
corepack yarn test:phase3:final
corepack yarn lint
corepack yarn typecheck
corepack yarn build
git diff --check
```

Objective sub-gates from `package.json`:

```bash
corepack yarn test:objective:simulator
corepack yarn test:objective:ingest
corepack yarn test:objective:features
corepack yarn test:objective:ml
corepack yarn test:objective:interpretation
corepack yarn test:objective:rbac
corepack yarn test:objective:dashboard
corepack yarn test:objective:safety
corepack yarn test:objective
```

`corepack yarn test:phase3:final` should run sequentially and is the current integrated hardening gate.

## 11. Known limitations

- Objective backend storage is largely in-memory/scaffold-level in the inspected source.
- Static SQL/RLS tests exist, but no live Supabase execution harness was verified.
- Supabase migrations/RLS/views are present and statically tested, but live Postgres/Supabase execution is not proven by this checkpoint.
- No live Supabase adapter/execution harness for objective backend history, replay, summary, stream, or raw storage persistence was verified.
- No production hardware ingestion is enabled.
- Prototype hardware bridge is disabled by default.
- Public dataset replay is skeleton-only.
- ML is bounded engineering scaffold/dev-only pipeline, not clinically validated.
- Calibration docs exist, but no clinical calibration is claimed.
- Objective monitoring is clinician-reviewable only.
- Frontend dashboard sections are mostly static safety scaffolds and tested route/copy components.
- Do not assume production-grade DB-backed objective infrastructure unless implemented later.

## 12. Known warnings/environment issues

Observed during recent validation and supported by command outputs in this branch:

- Yarn may warn about unwritable cache/global folders and fall back to `/tmp`.
- `ts-jest` may warn about Node16/18/Next hybrid module kind without `isolatedModules`.
- Existing lint warnings can appear while lint exits successfully, including `no-explicit-any` and unused variable warnings in non-objective baseline/frontend files.
- Safety tests emit verbose `safety_debug` logs.
- Next build may warn that edge runtime disables static generation for a page.
- Next lint may warn that the Next.js plugin was not detected in ESLint configuration.
- In restricted sandboxes, route tests that bind `127.0.0.1` may fail with `listen EPERM`; rerun with local-server permissions.
- Root typecheck and build should be run sequentially. Do not run them concurrently because generated `.next/types` can race in some environments.

## 13. Non-negotiable safety invariants

Objective data must not enter:

- chatbot prompt
- chatbot RAG
- chatbot memory
- LangGraph state
- finalGuard
- triage
- subjective reducer/planner/controller
- patient-facing responses
- chatbot API responses

Every surfaced objective output must respect:

```text
clinician_visible=true
patient_visible=false
chatbot_visible=false
```

Objective outputs must remain source-bound, uncertainty-bearing, clinician-reviewable, and non-diagnostic.

## 14. Forbidden claims/labels/fields

Forbidden objective labels include:

```text
craving_detected
relapse_risk
withdrawal_risk
intoxication_detected
AUD_severity
emergency_detected
treatment_need
detox_need
medication_need
CIWA_score
sobriety_status
patient_truthfulness
patient_is_lying
patient_is_safe
patient_is_stable
stress_proven
```

Raw fields that must not appear in safe outputs:

```text
ecg_raw
gsr_raw
max_red
max_ir
max_green
accel_x
accel_y
accel_z
gyro_x
gyro_y
gyro_z
mpu_temp_c
tmp117_temp_c
raw_payload
```

Forbidden route segments include:

```text
relapse-risk
withdrawal-risk
intoxication
ciwa
craving-detector
lie-detector
patient-truthfulness
sobriety-status
```

Forbidden-term exception:

Forbidden terms may appear in safety registries, scanner implementations, regression tests, validation-artifact forbidden-term lists, and documentation sections that explicitly name them as blocked terms. They must not appear as emitted objective outputs, clinician-safe payload fields, patient/chatbot surfaces, route names, clinical claims, or product behavior.

Allowed objective interpretation labels from `packages/objective-safety/src/registries.ts` are:

```text
low_or_baseline_arousal_evidence
elevated_physiological_arousal_evidence
stress_like_autonomic_activation_evidence
recovery_cooldown_trend
movement_activity_like_confound
signal_quality_limitation
cross_signal_agreement
cross_signal_disagreement
insufficient_reliable_data
ml_unavailable
simulated_data_notice
```

Naming warning:

- Current repo schema uses `recovery_cooldown_trend` as the allowed objective interpretation label.
- Current repo ML classes use `recovery_cooldown`.
- Do not invent `recovery_or_cooldown_evidence`.
- Do not use `recovery_cooldown_evidence` unless the safety registry/schema is explicitly changed later.

## 15. Safe vocabulary

Safe objective vocabulary includes:

```text
evidence
pattern
review item
technical review indicator
quality notice
signal note
interpretation suppressed
insufficient reliable data
baseline-relative
source context
not diagnostic
clinician-reviewable
uncertainty-bearing
technical limitation
quality/readiness context
source-bound physiological evidence
```

## 16. What future agents must not assume

Do not assume:

- objective data is connected to chatbot
- patient objective access exists
- hardware ingestion is enabled
- public dataset replay is complete
- ML is clinically validated
- DB/RLS has live Supabase execution coverage
- dashboard/history/replay are production-grade DB-backed unless later implemented
- any clinical diagnosis/risk/treatment output exists
- raw physiological values are safe to surface outside raw storage/quarantine internals
- Commit 75 changed runtime behavior; it added final gate/checkpoint hardening, not production logic

## 17. How to update this file after future commits

After every few commits:

1. Run `git status --short`.
2. Record latest commit hash and message.
3. Update implemented sections only for code actually present.
4. Update endpoint/route inventory only from actual source files.
5. Update validation commands if package scripts change.
6. Update known limitations if they are resolved or new ones are introduced.
7. Do not delete safety invariants.
8. Do not convert future plans into implemented facts.
9. Keep this file concise enough to be useful but detailed enough to prevent hallucination.

## Latest Repo Verification

GitHub connector verification completed.

Verified:
- Repo: Beastly713/dad-chatbot
- Branch: objective-monitoring
- Final Phase 3 implementation commit: b3cb125 chore(phase3): add final integration hardening release gate
- Later docs checkpoint exists for CURRENT_PROJECT_STATE.md
- Phase 3 final gate script exists: corepack yarn test:phase3:final
- Objective branch remains clinician-only
- Patient/chatbot objective access remains denied
- Storage remains scaffold/in-memory unless later changed
- Prototype hardware bridge remains disabled by default
- Public dataset replay remains skeleton-only
- No live Supabase execution harness should be assumed
- No diagnostic/craving/relapse/withdrawal/intoxication/treatment/detox/medication outputs should be assumed

Important correction:
Use objective label names from the actual repo registry, not stale prompt text.
