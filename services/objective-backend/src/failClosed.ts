import type { ObjectiveGuardResult } from "./auth.js";
import { createObjectiveSafeErrorBody } from "./errors.js";
import type { ObjectiveTraceContext } from "./trace.js";

export type ObjectiveFailClosedResponse = {
    statusCode: 401 | 403 | 500;
    body: ReturnType<typeof createObjectiveSafeErrorBody>;
};

export function failClosedFromGuard<T>(
    result: ObjectiveGuardResult<T>,
    trace: ObjectiveTraceContext,
): ObjectiveFailClosedResponse | null {
    if (result.allowed) {
        return null;
    }

    return {
        statusCode: result.statusCode,
        body: createObjectiveSafeErrorBody(trace, result.code, result.message),
    };
}

export function failClosedInternal(
    trace: ObjectiveTraceContext,
): ObjectiveFailClosedResponse {
    return {
        statusCode: 500,
        body: createObjectiveSafeErrorBody(
            trace,
            "objective_fail_closed",
            "Objective service request could not be completed safely.",
        ),
    };
}
