import fs from "fs";
import path from "path";

const FORBIDDEN_IMPORT_PATTERNS = [
    /backend\/src\/retrieval_graph/,
    /backend\/src\/safety/,
    /backend\/src\/subjective/,
    /frontend\/app\/api\/chat/,
    /frontend\/lib\/langgraph-base/,
    /retrieval_graph/,
    /finalGuard/,
    /triage/,
    /subjective/,
    /LangGraph/,
    /langgraph/,
] as const;

function sourceDirectory(): string {
    return path.join(process.cwd(), "src");
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

describe("objective backend service isolation", () => {
    it("does not import chatbot, LangGraph, safety triage, or subjective modules", () => {
        const files = collectSourceFiles(sourceDirectory());

        expect(files.length).toBeGreaterThan(0);

        for (const file of files) {
            const content = fs.readFileSync(file, "utf8");

            for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
                expect(content).not.toMatch(pattern);
            }
        }
    });
});
