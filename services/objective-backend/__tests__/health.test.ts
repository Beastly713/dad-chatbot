import http from "http";
import type { AddressInfo } from "net";
import { loadObjectiveBackendConfig } from "../src/config.js";
import { createObjectiveHttpServer } from "../src/server.js";

type HttpResponse = {
    statusCode: number;
    headers: http.IncomingHttpHeaders;
    body: string;
};

function requestJson(port: number, path: string): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: "127.0.0.1",
                port,
                path,
                method: "GET",
                headers: {
                    "x-request-id": "test-request-id",
                    "x-trace-id": "test-trace-id",
                },
            },
            (response) => {
                const chunks: Buffer[] = [];

                response.on("data", (chunk: Buffer) => {
                    chunks.push(chunk);
                });

                response.on("end", () => {
                    resolve({
                        statusCode: response.statusCode ?? 0,
                        headers: response.headers,
                        body: Buffer.concat(chunks).toString("utf8"),
                    });
                });
            },
        );

        request.on("error", reject);
        request.end();
    });
}

function listen(server: http.Server): Promise<number> {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address() as AddressInfo;
            resolve(address.port);
        });
    });
}

function close(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

describe("objective backend health endpoint", () => {
    it("serves a clinician-only non-diagnostic health response", async () => {
        const config = loadObjectiveBackendConfig({
            NODE_ENV: "test",
            OBJECTIVE_BACKEND_PORT: "0",
        });
        const server = createObjectiveHttpServer(config);
        const port = await listen(server);

        try {
            const response = await requestJson(port, "/health");
            const parsed = JSON.parse(response.body) as Record<string, unknown>;

            expect(response.statusCode).toBe(200);
            expect(response.headers["x-request-id"]).toBe("test-request-id");
            expect(response.headers["x-trace-id"]).toBe("test-trace-id");
            expect(parsed).toEqual({
                service: "objective-backend",
                status: "ok",
                phase: "phase3_objective_monitoring",
                objective_scope: "clinician_only_non_diagnostic",
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
                environment: "test",
                request_id: "test-request-id",
                trace_id: "test-trace-id",
            });
        } finally {
            await close(server);
        }
    });

    it("also serves /api/objective/health", async () => {
        const config = loadObjectiveBackendConfig({
            NODE_ENV: "test",
            OBJECTIVE_BACKEND_PORT: "0",
        });
        const server = createObjectiveHttpServer(config);
        const port = await listen(server);

        try {
            const response = await requestJson(port, "/api/objective/health");

            expect(response.statusCode).toBe(200);
        } finally {
            await close(server);
        }
    });

    it("returns a safe error body for unknown routes", async () => {
        const config = loadObjectiveBackendConfig({
            NODE_ENV: "test",
            OBJECTIVE_BACKEND_PORT: "0",
        });
        const server = createObjectiveHttpServer(config);
        const port = await listen(server);

        try {
            const response = await requestJson(port, "/unknown");
            const parsed = JSON.parse(response.body) as Record<string, unknown>;

            expect(response.statusCode).toBe(404);
            expect(JSON.stringify(parsed)).toContain("objective_route_not_found");
            expect(JSON.stringify(parsed)).not.toContain("stack");
            expect(JSON.stringify(parsed)).not.toContain("raw_payload");
            expect(JSON.stringify(parsed)).not.toContain("sensor");
        } finally {
            await close(server);
        }
    });
});
