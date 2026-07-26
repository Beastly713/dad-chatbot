# Phase 3 Calibration Note

Status: engineering/safety validation only, not clinical validation.

This artifact records the Phase 3 calibration boundary. It is not diagnostic and does not establish care-use validity.

Global visibility invariant:

- clinician_visible=true
- patient_visible=false
- chatbot_visible=false

## Current calibration status

Phase 3 uses baseline-relative engineering features and bounded model outputs. The current implementation does not establish clinical calibration.

The system can preserve calibration metadata, model version metadata, preprocessing version metadata, feature schema version metadata, and uncertainty reasons. These are engineering traceability fields, not care-use calibration evidence.

## What is covered

- Baseline-relative feature calculation.
- Quality/readiness context.
- Missingness context.
- Motion confound context.
- Source-type context.
- Suppression state.
- Uncertainty reasons.
- Safe interpretation mapping.

## What is not claimed

- No clinical calibration.
- No patient-level care-use calibration.
- No hardware-readiness calibration.
- No public-dataset clinical transfer claim.
- No patient safety status.

## Required future work before any stronger claim

- Real dataset governance.
- Dataset provenance review.
- External validation protocol.
- Calibration protocol review.
- Hardware characterization.
- Clinician workflow review.
- Independent safety review.

Until then, all outputs remain clinician-reviewable, source-bound, and uncertainty-bearing.
