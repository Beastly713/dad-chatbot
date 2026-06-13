# Phase 3 ML Model Card

Status: engineering/safety validation only, not clinical validation.

This artifact summarizes the Phase 3 ML service boundary. It is not diagnostic and does not establish care-use validity.

Global visibility invariant:

- clinician_visible=true
- patient_visible=false
- chatbot_visible=false

## Intended use

The ML service provides one bounded input for clinician-reviewable objective interpretation. The target is baseline_relative_elevated_physiological_arousal_evidence.

The output is source-bound physiological evidence with uncertainty. It does not override quality checks, suppression state, interpretation mapping, RBAC, or no-leak boundaries.

## Implemented model paths

- Rule-safe stub behavior for insufficient reliable data paths.
- Dev-only classical pipeline artifacts for engineering comparison.
- Bounded response contract validation in objective backend tests.
- Model output storage with clinician-only visibility.

## Evidence files

- services/objective-ml/tests/test_contracts.py
- services/objective-ml/tests/test_model_stub.py
- services/objective-ml/tests/test_model_pipeline.py
- services/objective-ml/tests/test_stage8_regression.py
- services/objective-backend/__tests__/mlInferenceContract.test.ts
- services/objective-backend/__tests__/mlInferenceClient.test.ts
- services/objective-backend/__tests__/mlInferenceRegressionSafety.test.ts
- services/objective-backend/__tests__/mlInferenceStorage.test.ts

## Allowed output framing

- low_or_baseline_arousal_evidence
- elevated_arousal_evidence
- recovery_cooldown
- insufficient_reliable_data
- ml_unavailable

## Safety limitations

- No clinical validation claim.
- No clinical calibration claim.
- No patient-facing output.
- No chatbot-facing output.
- No care-use readiness claim.
- No hardware-readiness claim.
- No standalone conclusion.

## Release position

The Phase 3 ML component is accepted only as bounded engineering infrastructure for clinician-reviewable source-bound physiological evidence. It remains quality-gated, uncertainty-bearing, and separated from chatbot and patient flows.
