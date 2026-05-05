# Phase 2 Subjective Check-in Runbook

This runbook explains the Phase 2 subjective check-in layer for the Safe Alcohol-SUD Support Chatbot.

Phase 2 adds an optional, structured, non-diagnostic subjective check-in layer for safe-support conversations. It does not replace Phase 1 safety.

## What Phase 2 adds

Phase 2 adds a lightweight subjective state layer for safe-support categories only. It can collect or infer low-stakes, user-reported support-routing evidence such as craving level, distress level, coping confidence, alcohol availability, recent drinking or lapse disclosure, social context, support preference, skipped or vague answers, uncertainty markers, and safety red flags from structured check-in answers.

This state is used only to tailor supportive response style, brevity, coping suggestions, and KB grounding. It is not used for diagnosis or clinical scoring.

## What Phase 2 does not add

Phase 2 does not add:

- AUD diagnosis
- clinical relapse-risk score
- craving score interpretation
- withdrawal score
- CIWA-Ar workflow
- AUDIT or AUDIT-C routine chat flow
- BAM workflow
- detox guidance
- medication guidance
- dosage guidance
- treatment planning
- country-specific hotline routing
- second-substance support
- objective physiology branch
- multimodal fusion
- persistent sensitive self-report database

## Core safety principle

Subjective state may tune support, but it may never weaken safety.

```text
deterministic triage
→ policy selection
→ template-only safety path OR safe-support subjective path
→ finalGuard
→ final answer
```

High-risk, refusal, and out-of-scope categories remain template-only. Template-only paths must not call Supabase retriever, OpenRouter LLM, or subjective check-in UI.

## Phase 2 graph flow

### Template-only path

```text
inputTriage
→ policySelector
→ templateResponder
→ finalSafetyGuard
→ END
```

This applies to:

```text
self_harm_or_immediate_danger
possible_medical_emergency
withdrawal_or_detox_concern
medication_or_dosage_request
unsafe_alcohol_request
prompt_injection_or_policy_bypass
out_of_scope
```

### Safe-support path

```text
inputTriage
→ policySelector
→ subjectiveStateExtractor
→ subjectiveStateReducer
→ subjectiveCheckInPlanner
```

Then either:

```text
checkInRequestBuilder
→ finalSafetyGuard
→ assistant check-in prompt + uiAction
```

or:

```text
subjectivePolicyController
→ retrieveDocuments
→ generateSafeResponse
→ finalSafetyGuard
→ final answer
```

Safe-support categories are:

```text
alcohol_craving
lapse_or_relapse
general_support
```

## Check-in behavior

The check-in is optional and skippable. The assistant may say:

```text
If you want, a very quick check-in can help me tailor this. You can also skip it.
```

The frontend renders an inline card with chips. Example fields include alcohol availability, coping confidence, support preference, craving level, distress level, and recent use status.

The UI must not say:

```text
assessment complete
your score is
diagnosis
relapse risk score
withdrawal stage
```

## Red-flag behavior

If the original message or structured check-in answer contains a red flag, ordinary personalization stops.

Examples:

```text
I drank and need to drive home.
I'm shaking and seeing things after stopping drinking.
I mixed alcohol with sleeping pills.
I want to kill myself.
```

These must route to deterministic template-only safety responses. Structured check-in answers may escalate upward, but they must never downgrade an already dangerous category.

## Subjective state is not clinical state

Subjective state is a support-routing bundle. It may include cravingLevel, distressLevel, copingConfidence, supportPreference, recentUseStatus, alcoholAvailability, socialContext, triggerContext, shameCue, uncertainty, trend, and allowedResponseInfluence.

It must not include:

```text
clinicalRiskScore
relapseRiskScore
withdrawalScore
AUDSeverity
diagnosis
CIWAResult
```

## Prompting rules

The safe response prompt may receive a sanitized subjective state summary.

Allowed summary style:

```text
Current support context:
- User-reported craving: very high.
- User-reported coping confidence: low.
- Alcohol may be nearby.
- Preferred support: practical step.
- Use concise immediate coping style.
```

Forbidden summary content:

```text
raw red-flag narratives
internal policy names
diagnosis labels
clinical scores
CIWA or withdrawal scoring
treatment plans
hidden safety rules
```

## KB behavior

Phase 2 adds curated internal alcohol-support notes for high craving, alcohol nearby, low confidence, social pressure, shame after lapse, next hour safer after drinking, grounding for distress and craving, contacting a support person, ambivalence / low readiness, and one tiny practical step.

Required metadata remains:

```json
{
  "source": "internal_kb",
  "substance": "alcohol",
  "approved": true,
  "userVisible": true
}
```

Phase 2 documents use:

```json
{
  "version": "phase2-v1"
}
```

Retrieval remains category-based for stability. Do not make retrieval depend on `stateTag`, `supportNeed`, or `deliveryStyle` yet.

## API contract

### Normal chat request

```json
{
  "message": "I really want a drink right now.",
  "threadId": "optional-existing-thread-id",
  "checkInResponse": null,
  "clientMeta": {
    "source": "chat_input"
  }
}
```

### Check-in submit request

```json
{
  "message": "",
  "threadId": "existing-thread-id",
  "checkInResponse": {
    "requestId": "phase2-checkin-...",
    "answers": {
      "craving_level": "very_high",
      "coping_confidence": "low",
      "alcohol_availability": "nearby",
      "support_preference": "practical_step"
    },
    "skippedFields": [],
    "submittedAt": "2026-05-05T10:00:00.000Z"
  },
  "clientMeta": {
    "source": "micro_checkin"
  }
}
```

### Check-in skip request

```json
{
  "message": "",
  "threadId": "existing-thread-id",
  "checkInResponse": {
    "requestId": "phase2-checkin-...",
    "answers": {},
    "skippedFields": ["all"],
    "submittedAt": "2026-05-05T10:00:00.000Z"
  },
  "clientMeta": {
    "source": "skip_action"
  }
}
```

## SSE response behavior

The API may emit:

```text
updates.threadId
updates.uiAction
updates.retrieveDocuments
messages/partial
```

`messages/partial` is still used for frontend compatibility. Phase 2 must still emit only one final guarded assistant message, not token-level partial streaming.

## Required backend commands

From `backend`:

```bash
corepack yarn test:phase1
corepack yarn test:phase2
corepack yarn tsc --noEmit
```

## Required frontend commands

From `frontend`:

```bash
corepack yarn lint
corepack yarn build
```

## Seed Phase 1 + Phase 2 alcohol KB

From `backend`:

```bash
corepack yarn tsx scripts/seedAlcoholKb.ts
```

Expected:

```text
Seeded 18 alcohol KB documents across versions: phase1-v1, phase2-v1.
```

If `tsx` is unavailable, use the project’s existing TypeScript execution method. Do not add new dependencies just for seeding unless the team decides to.

## Local services

Terminal 1:

```bash
cd backend
corepack yarn langgraph:dev
```

Terminal 2:

```bash
cd frontend
corepack yarn dev
```

Open:

```text
http://localhost:3000
```

## Known limitations

Phase 2 is still early and intentionally bounded.

Known limitations:

- subjective extraction is deterministic only
- no LLM extraction
- no persistent subjective database
- no second-substance adapter
- no objective physiology input
- no multimodal fusion
- no clinical scoring
- no clinician dashboard
- no human handoff automation
- no country-specific hotline database

## Operational invariant

Before marking Phase 2 stable:

```text
Phase 1 tests pass.
Phase 2 tests pass.
Backend TypeScript passes.
Frontend lint passes.
Frontend build passes.
Template-only paths show no check-in card.
Template-only paths return no support sources.
Safe-support check-ins are optional and skippable.
Structured red flags escalate.
finalGuard runs on every user-facing output.
```
