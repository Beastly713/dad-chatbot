# Phase 3 Simulator Scenario Coverage Matrix

Status: engineering/safety validation only, not clinical validation.

This artifact summarizes simulator scenario coverage for the clinician-facing objective monitoring layer. It is not diagnostic and does not establish care-use validity.

Global visibility invariant:

- clinician_visible=true
- patient_visible=false
- chatbot_visible=false

## Scope

The simulator is used for source-bound engineering checks. It supports repeatable validation of pipeline behavior, safe degradation, and clinician-reviewable output boundaries.

## Scenario coverage

| Scenario | Coverage intent | Evidence |
| --- | --- | --- |
| baseline_rest | Baseline-oriented source context and stable technical review indicator coverage. | packages/objective-simulator/__tests__/scenarios.test.ts; services/objective-backend/__tests__/stage13SimulatorDashboardHappyPath.test.ts |
| elevated_arousal_pattern | Baseline-relative elevated physiological arousal evidence coverage with uncertainty-bearing interpretation. | packages/objective-simulator/src/scenarios.ts; services/objective-backend/__tests__/stage13SimulatorDashboardHappyPath.test.ts |
| recovery_cooldown | Recovery cooldown evidence coverage after elevated physiological arousal evidence. | packages/objective-simulator/src/scenarios.ts; packages/objective-interpretation/__tests__/mapper.test.ts |
| motion_artifact | Movement/context confound coverage and quality notice behavior. | services/objective-backend/__tests__/stage13DegradedScenarios.test.ts |
| poor_contact | Signal quality limitation coverage and interpretation suppressed behavior where needed. | services/objective-backend/__tests__/stage13DegradedScenarios.test.ts |
| sensor_dropout | Missingness and insufficient reliable data coverage. | packages/objective-simulator/__tests__/injections.test.ts; services/objective-backend/__tests__/stage13DegradedScenarios.test.ts |
| signal_conflict | Cross-signal disagreement coverage with clinician-reviewable uncertainty. | services/objective-backend/__tests__/stage13DegradedScenarios.test.ts |
| device_reset_or_timing_gap | Timing discontinuity and segment-boundary coverage. | packages/objective-simulator/__tests__/timeline.test.ts; services/objective-backend/__tests__/stage5IngestionClosure.test.ts |

## Release evidence

- Stage 13 happy path validates simulator-to-clinician-safe pipeline behavior.
- Stage 13 degraded scenarios validate safe handling of motion confound, dropout, poor contact, signal conflict, and ML unavailable conditions.
- Stage 17 final acceptance matrix validates that required release scenarios remain represented.

## Explicit non-claims

This matrix is not clinical validation. It does not claim clinical calibration, patient safety status, care readiness, or hardware readiness.
