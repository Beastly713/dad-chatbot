# Phase 3 Feature Validation Report

Status: engineering/safety validation only, not clinical validation.

This artifact summarizes feature-window validation for the clinician-facing objective monitoring layer. It is not diagnostic and does not establish care-use validity.

Global visibility invariant:

- clinician_visible=true
- patient_visible=false
- chatbot_visible=false

## Scope

Feature validation covers raw timing checks, window construction, signal-quality context, baseline-relative features, modality availability, missingness, and cross-signal context.

## Evidence files

- packages/objective-preprocessing/__tests__/windowing.test.ts
- packages/objective-preprocessing/__tests__/ecgGsrFeatures.test.ts
- packages/objective-preprocessing/__tests__/ppgImuTemperatureFeatures.test.ts
- packages/objective-preprocessing/__tests__/baselineManager.test.ts
- packages/objective-preprocessing/__tests__/crossSignalFeatures.test.ts
- packages/objective-preprocessing/__tests__/stage7GoldenFeatureWindows.test.ts
- services/objective-backend/__tests__/featureStorage.test.ts

## Validated engineering behaviors

- Timing windows are constructed from source-bound raw ranges.
- Feature windows preserve source type, session, segment, and raw range references.
- Modality availability and missingness are carried as quality/readiness context.
- Baseline-relative values are stored as source-bound physiological evidence.
- Motion confound and signal-quality limitation paths remain uncertainty-bearing.
- Suppressed or limited windows remain clinician-reviewable without patient or chatbot visibility.

## Boundaries

- Feature validation does not establish clinical calibration.
- Feature windows are not standalone conclusions.
- Feature windows do not enter chatbot prompt construction, RAG retrieval, memory, LangGraph state, final guard logic, subjective state, or patient-facing chat responses.
