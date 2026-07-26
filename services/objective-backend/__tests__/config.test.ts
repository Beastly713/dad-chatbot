import { loadObjectiveBackendConfig } from "../src/config.js";

describe("objective backend config", () => {
    it("loads safe defaults", () => {
        expect(loadObjectiveBackendConfig({})).toEqual({
            serviceName: "objective-backend",
            environment: "development",
            port: 4310,
        });
    });

    it("loads explicit environment and port", () => {
        expect(
            loadObjectiveBackendConfig({
                NODE_ENV: "test",
                OBJECTIVE_BACKEND_PORT: "0",
            }),
        ).toEqual({
            serviceName: "objective-backend",
            environment: "test",
            port: 0,
        });
    });

    it("rejects invalid ports", () => {
        expect(() =>
            loadObjectiveBackendConfig({
                OBJECTIVE_BACKEND_PORT: "not-a-number",
            }),
        ).toThrow("OBJECTIVE_BACKEND_PORT");

        expect(() =>
            loadObjectiveBackendConfig({
                OBJECTIVE_BACKEND_PORT: "70000",
            }),
        ).toThrow("OBJECTIVE_BACKEND_PORT");
    });
});
