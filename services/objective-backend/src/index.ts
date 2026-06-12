import { pathToFileURL } from "url";
import { loadObjectiveBackendConfig } from "./config.js";
import { createObjectiveHttpServer } from "./server.js";

export * from "./config.js";
export * from "./trace.js";
export * from "./errors.js";
export * from "./health.js";
export * from "./server.js";
export * from "./auth.js";
export * from "./assignments.js";
export * from "./visibility.js";
export * from "./failClosed.js";
export * from "./audit.js";
export * from "./sessionLifecycle.js";
export * from "./sessionRoutes.js";
export * from "./sessionHistory.js";
export * from "./sessionHistoryRoutes.js";
export * from "./sessionReplay.js";
export * from "./sessionReplayRoutes.js";
export * from "./sessionSummary.js";
export * from "./sessionSummaryRoutes.js";
export * from "./rawIngestion.js";
export * from "./rawIngestionRoutes.js";
export * from "./rawTraceabilityRoutes.js";
export * from "./rawTiming.js";
export * from "./rawStorage.js";
export * from "./featureStorage.js";
export * from "./mlInferenceContract.js";
export * from "./mlInferenceClient.js";
export * from "./mlInferenceStorage.js";
export * from "./interpretationStorage.js";
export * from "./segmentManager.js";
export * from "./streamTokens.js";
export * from "./streamEvents.js";
export * from "./streamRoutes.js";

function isMainModule(): boolean {
    const entrypoint = process.argv[1];

    if (!entrypoint) {
        return false;
    }

    return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isMainModule()) {
    const config = loadObjectiveBackendConfig();
    const server = createObjectiveHttpServer(config);

    server.listen(config.port, () => {
        const address = server.address();
        const port =
            typeof address === "object" && address !== null
                ? address.port
                : config.port;

        process.stdout.write(
            `objective-backend listening on port ${String(port)}\n`,
        );
    });
}
