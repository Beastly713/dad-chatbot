import http, {
    type IncomingMessage,
    type Server,
    type ServerResponse,
} from "http";
import type { ObjectiveBackendConfig } from "./config.js";
import { createObjectiveSafeErrorBody } from "./errors.js";
import { createObjectiveHealthResponse } from "./health.js";
import {
    createDefaultObjectiveRawIngestionRepository,
    handleObjectiveRawIngestionRoute,
    type ObjectiveRawIngestionRouteDependencies,
} from "./rawIngestionRoutes.js";
import {
    createDefaultObjectiveSessionRouteDependencies,
    handleObjectiveSessionRoute,
    type ObjectiveSessionRouteDependencies,
} from "./sessionRoutes.js";
import { createObjectiveTraceContext } from "./trace.js";

type JsonBody = Record<string, unknown>;

function writeJson(
    response: ServerResponse,
    statusCode: number,
    body: JsonBody,
): void {
    const serialized = JSON.stringify(body);

    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("content-length", Buffer.byteLength(serialized));
    response.end(serialized);
}

function isHealthPath(pathname: string): boolean {
    return pathname === "/health" || pathname === "/api/objective/health";
}

export function handleObjectiveRequest(
    request: IncomingMessage,
    response: ServerResponse,
    config: ObjectiveBackendConfig,
): void {
    const trace = createObjectiveTraceContext(request.headers);

    try {
        const host = request.headers.host ?? "localhost";
        const url = new URL(request.url ?? "/", `http://${host}`);

        response.setHeader("x-request-id", trace.requestId);
        response.setHeader("x-trace-id", trace.traceId);

        if (request.method === "GET" && isHealthPath(url.pathname)) {
            writeJson(response, 200, createObjectiveHealthResponse(config, trace));
            return;
        }

        writeJson(
            response,
            404,
            createObjectiveSafeErrorBody(
                trace,
                "objective_route_not_found",
                "Objective service route not found.",
            ),
        );
    } catch {
        writeJson(
            response,
            500,
            createObjectiveSafeErrorBody(
                trace,
                "objective_internal_error",
                "Objective service request could not be completed safely.",
            ),
        );
    }
}

export function createObjectiveHttpServer(
    config: ObjectiveBackendConfig,
    sessionDependencies: ObjectiveSessionRouteDependencies =
        createDefaultObjectiveSessionRouteDependencies(),
    rawIngestionDependencies: ObjectiveRawIngestionRouteDependencies = {
        ...sessionDependencies,
        rawIngestion: createDefaultObjectiveRawIngestionRepository(),
    },
): Server {
    return http.createServer((request, response) => {
        void (async () => {
            const handledRawIngestionRoute = await handleObjectiveRawIngestionRoute(
                request,
                response,
                rawIngestionDependencies,
            );

            if (handledRawIngestionRoute) {
                return;
            }

            const handledSessionRoute = await handleObjectiveSessionRoute(
                request,
                response,
                sessionDependencies,
            );

            if (handledSessionRoute) {
                return;
            }

            handleObjectiveRequest(request, response, config);
        })();
    });
}
