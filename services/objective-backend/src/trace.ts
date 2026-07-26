import { randomUUID } from "crypto";
import type { IncomingHttpHeaders } from "http";

export type ObjectiveTraceContext = {
    requestId: string;
    traceId: string;
};

function firstHeaderValue(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    return value ?? null;
}

function cleanHeaderValue(value: string | null): string | null {
    if (value === null) {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function createObjectiveTraceContext(
    headers: IncomingHttpHeaders = {},
): ObjectiveTraceContext {
    const requestId =
        cleanHeaderValue(firstHeaderValue(headers["x-request-id"])) ?? randomUUID();
    const traceId =
        cleanHeaderValue(firstHeaderValue(headers["x-trace-id"])) ?? requestId;

    return {
        requestId,
        traceId,
    };
}
