# Phase 3 RBAC and RLS Report

Status: engineering/safety validation only, not clinical validation.

This artifact summarizes access-control and storage-boundary validation. It is not diagnostic and does not establish care-use validity.

Global visibility invariant:

- clinician_visible=true
- patient_visible=false
- chatbot_visible=false

## Access model

| Role | Objective access position |
| --- | --- |
| Patient | Denied from objective access. No patient objective dashboard. No patient objective API. |
| Chatbot | Denied from objective access. No chatbot objective route. No objective data in chatbot response paths. |
| Clinician | Assigned-patient access only for clinician-safe objective surfaces. |
| Service | Service producer role for bounded ingestion and infrastructure tasks. |
| Developer | Debug-only tooling where explicitly gated. No clinician/patient session access unless explicitly designed. |

## Evidence files

- services/objective-backend/__tests__/auth.test.ts
- services/objective-backend/__tests__/assignments.test.ts
- services/objective-backend/__tests__/audit.test.ts
- services/objective-backend/__tests__/failClosed.test.ts
- services/objective-backend/__tests__/sessionLifecycle.test.ts
- services/objective-backend/__tests__/sessionRoutes.test.ts
- services/objective-backend/__tests__/streamTokens.test.ts
- services/objective-backend/__tests__/streamStage10Security.test.ts
- services/objective-backend/__tests__/streamReconnectRevocation.test.ts
- services/objective-backend/__tests__/stage12HistoryAccessRegression.test.ts
- services/objective-backend/__tests__/stage14RbacAccessRelease.test.ts
- services/objective-backend/__tests__/prototypeHardwareBridgeSecurity.test.ts

## Storage and policy evidence

Database migrations define isolated objective schema tables, source types, visibility flags, audit tables, and RLS/view scaffolding for clinician-safe access boundaries.

## Release position

The RBAC/RLS layer is accepted as engineering access-control validation. It does not establish production deployment completeness or clinical validation.
