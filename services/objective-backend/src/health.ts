import type { ObjectiveBackendConfig } from "./config.js";
import type { ObjectiveTraceContext } from "./trace.js";

export type ObjectiveHealthResponse = {
    service: "objective-backend";
    status: "ok";
    phase: "phase3_objective_monitoring";
    objective_scope: "clinician_only_non_diagnostic";
    clinician_visible: true;
    patient_visible: false;
    chatbot_visible: false;
    environment: string;
    request_id: string;
    trace_id: string;
};

export function createObjectiveHealthResponse(
    config: ObjectiveBackendConfig,
    trace: ObjectiveTraceContext,
): ObjectiveHealthResponse {
    return {
        service: config.serviceName,
        status: "ok",
        phase: "phase3_objective_monitoring",
        objective_scope: "clinician_only_non_diagnostic",
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
        environment: config.environment,
        request_id: trace.requestId,
        trace_id: trace.traceId,
    };
}
