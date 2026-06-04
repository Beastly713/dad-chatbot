// services/objective-backend/__tests__/stage5BoundaryDrift.test.ts

import fs from "fs";
import path from "path";

const SERVICE_ROOT = process.cwd();
const SRC_DIR = path.join(SERVICE_ROOT, "src");

function readSource(relativePath: string): string {
    return fs.readFileSync(path.join(SRC_DIR, relativePath), "utf8");
}

function collectSourceFiles(directory: string): string[] {
    const files: string[] = [];

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith(".ts")) {
            files.push(fullPath);
        }
    }

    return files;
}

describe("Stage 5 objective ingestion boundary and drift regression", () => {
    it("keeps the canonical batch ingestion endpoint present", () => {
        const source = readSource("rawIngestionRoutes.ts");

        expect(source).toContain("/api/objective/ingest/batch");
        expect(source).toContain('mode: "canonical"');
    });

    it("keeps session-scoped ingestion as an alias rather than the only route", () => {
        const source = readSource("rawIngestionRoutes.ts");

        expect(source).toContain("/api/objective/ingest/batch");
        expect(source).toContain('mode: "session_alias"');
        expect(source).toContain("\\/api\\/objective\\/sessions");
        expect(source).toContain("/ingest");
    });

    it("keeps raw ingestion service-role only", () => {
        const source = readSource("rawIngestion.ts");

        expect(source).toContain('actor.role !== "service"');
        expect(source).toContain("objective_ingest_service_required");
        expect(source).toContain(
            "Objective raw ingestion requires a service producer identity.",
        );
    });

    it("keeps raw ingestion tied to session access and session source type", () => {
        const source = readSource("rawIngestion.ts");

        expect(source).toContain("requireSessionAccess");
        expect(source).toContain("objective_batch_source_mismatch");
        expect(source).toContain("session.source_type");
        expect(source).toContain("batchInput.value.source_type");
    });

    it("keeps server route order specific-before-generic", () => {
        const source = readSource("server.ts");

        const rawIngestionIndex = source.indexOf(
            "handleObjectiveRawIngestionRoute",
        );
        const rawTraceabilityIndex = source.indexOf(
            "handleObjectiveRawTraceabilityRoute",
        );
        const sessionRouteIndex = source.indexOf("handleObjectiveSessionRoute");
        const fallbackIndex = source.indexOf("handleObjectiveRequest");

        expect(rawIngestionIndex).toBeGreaterThanOrEqual(0);
        expect(rawTraceabilityIndex).toBeGreaterThan(rawIngestionIndex);
        expect(sessionRouteIndex).toBeGreaterThan(rawTraceabilityIndex);
        expect(fallbackIndex).toBeGreaterThan(sessionRouteIndex);
    });

    it("keeps traceability route responses raw-payload free", () => {
        const source = readSource("rawTraceabilityRoutes.ts");

        expect(source).not.toMatch(/raw_payload(?!_shape)/);
        expect(source).not.toContain("rawPayload");
        expect(source).not.toContain("ecg_raw");
        expect(source).not.toContain("gsr_raw");
        expect(source).not.toContain("max_red");
        expect(source).not.toContain("max_ir");
        expect(source).not.toContain("max_green");
        expect(source).not.toContain("accel_x");
        expect(source).not.toContain("gyro_x");
        expect(source).not.toContain("tmp117_temp_c");
        expect(source).not.toContain("mpu_temp_c");
        expect(source).not.toContain("reject_details");
    });

    it("keeps audit metadata blocking raw physiological values and free text", () => {
        const source = readSource("audit.ts");

        for (const blockedKey of [
            "raw_payload",
            "ecg_raw",
            "gsr_raw",
            "max_red",
            "max_ir",
            "max_green",
            "accel_x",
            "accel_y",
            "accel_z",
            "gyro_x",
            "gyro_y",
            "gyro_z",
            "mpu_temp_c",
            "tmp117_temp_c",
            "note_text",
            "summary_text",
            "prompt",
            "response",
            "message",
            "user_input",
        ]) {
            expect(source).toContain(`"${blockedKey}"`);
        }
    });

    it("keeps Stage 5 objective backend isolated from chatbot and LangGraph code", () => {
        const forbiddenPatterns = [
            /backend\/src\/retrieval_graph/,
            /backend\/src\/safety/,
            /backend\/src\/subjective/,
            /frontend\/app\/api\/chat/,
            /frontend\/lib\/langgraph-base/,
            /retrieval_graph/,
            /finalGuard/,
            /subjective/,
            /LangGraph/,
            /langgraph/,
        ];

        for (const file of collectSourceFiles(SRC_DIR)) {
            const content = fs.readFileSync(file, "utf8");

            for (const pattern of forbiddenPatterns) {
                expect(content).not.toMatch(pattern);
            }
        }
    });

    it("does not introduce Stage 6 simulator implementation before Stage 6 starts", () => {
        const allSource = collectSourceFiles(SRC_DIR)
            .map((file) => fs.readFileSync(file, "utf8"))
            .join("\n");

        expect(allSource).not.toContain("scenarioTimeline");
        expect(allSource).not.toContain("simulatorProfile");
        expect(allSource).not.toContain("createSimulator");
        expect(allSource).not.toContain("generateScenario");
    });

    it("does not introduce model registry, interpretation, dashboard, or chatbot wiring in service code", () => {
        const allSource = collectSourceFiles(SRC_DIR)
            .map((file) => fs.readFileSync(file, "utf8"))
            .join("\n");

        expect(allSource).not.toContain("featureExtraction");
        expect(allSource).not.toContain("modelRegistry");
        expect(allSource).not.toContain("interpretationRecord");
        expect(allSource).not.toContain("dashboard");
        expect(allSource).not.toContain("chatbot_visible: true");
        expect(allSource).not.toContain("patient_visible: true");
    });
});
