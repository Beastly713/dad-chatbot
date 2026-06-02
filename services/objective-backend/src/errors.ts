import type { ObjectiveTraceContext } from "./trace.js";

export type ObjectiveSafeErrorBody = {
    error: {
        code: string;
        message: string;
        request_id: string;
        trace_id: string;
    };
};

export function createObjectiveSafeErrorBody(
    trace: ObjectiveTraceContext,
    code: string,
    message = "Objective service request could not be completed safely.",
): ObjectiveSafeErrorBody {
    return {
        error: {
            code,
            message,
            request_id: trace.requestId,
            trace_id: trace.traceId,
        },
    };
}
