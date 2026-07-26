import { failClosedFromGuard, failClosedInternal } from "../src/failClosed.js";
import type { ObjectiveGuardResult } from "../src/auth.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const trace: ObjectiveTraceContext = {
    requestId: "request-1",
    traceId: "trace-1",
};

describe("objective backend fail-closed helpers", () => {
    it("returns null for allowed guard results", () => {
        const result: ObjectiveGuardResult<{ ok: true }> = {
            allowed: true,
            value: { ok: true },
            auditEvent: null,
        };

        expect(failClosedFromGuard(result, trace)).toBeNull();
    });

    it("converts denied guard results to safe error bodies", () => {
        const result: ObjectiveGuardResult<never> = {
            allowed: false,
            statusCode: 403,
            code: "objective_assignment_required",
            message: "Objective patient-scoped access requires an active assignment.",
            auditEvent: {
                event_type: "access_denied",
                reason: "unassigned_clinician",
                request_id: "request-1",
                trace_id: "trace-1",
            },
        };

        expect(failClosedFromGuard(result, trace)).toEqual({
            statusCode: 403,
            body: {
                error: {
                    code: "objective_assignment_required",
                    message:
                        "Objective patient-scoped access requires an active assignment.",
                    request_id: "request-1",
                    trace_id: "trace-1",
                },
            },
        });
    });

    it("creates a safe generic internal fail-closed response", () => {
        const response = failClosedInternal(trace);

        expect(response.statusCode).toBe(500);
        expect(response.body.error.code).toBe("objective_fail_closed");
        expect(JSON.stringify(response)).not.toContain("stack");
        expect(JSON.stringify(response)).not.toContain("raw_payload");
    });
});
