export type ObjectiveBackendConfig = {
    serviceName: "objective-backend";
    environment: string;
    port: number;
};

export type ObjectiveBackendEnv = {
    NODE_ENV?: string;
    OBJECTIVE_BACKEND_PORT?: string;
};

function parsePort(value: string | undefined): number {
    if (value === undefined || value.trim() === "") {
        return 4310;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        throw new Error("OBJECTIVE_BACKEND_PORT must be an integer from 0 to 65535");
    }

    return parsed;
}

export function loadObjectiveBackendConfig(
    env: ObjectiveBackendEnv = process.env,
): ObjectiveBackendConfig {
    return {
        serviceName: "objective-backend",
        environment: env.NODE_ENV ?? "development",
        port: parsePort(env.OBJECTIVE_BACKEND_PORT),
    };
}
