import fs from "fs";
import path from "path";

const FRONTEND_ROOT = process.cwd();

function appPath(...segments: string[]): string {
    return path.join(FRONTEND_ROOT, "app", ...segments);
}

function read(filePath: string): string {
    return fs.readFileSync(filePath, "utf8");
}

function collectFiles(directory: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(directory)) {
        return files;
    }

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }

    return files;
}

function repoRelative(filePath: string): string {
    return path.relative(FRONTEND_ROOT, filePath).split(path.sep).join("/");
}

function expectNoMatch(content: string, pattern: RegExp, file: string): void {
    if (pattern.test(content)) {
        throw new Error(`${repoRelative(file)} unexpectedly matched ${pattern}`);
    }
}

describe("Stage 12 clinician notes separation regression", () => {
    const routeRoot = appPath("(clinician)", "clinician", "objective");
    const notesLib = appPath(
        "(clinician)",
        "clinician",
        "objective",
        "_lib",
        "sessionTimelineNotes.ts",
    );
    const notesComponent = appPath(
        "(clinician)",
        "clinician",
        "objective",
        "_components",
        "ObjectiveSessionTimelineSummaryNotes.tsx",
    );

    it("keeps clinician-authored notes separated from automated objective records", () => {
        const combined = `${read(notesLib)}\n${read(notesComponent)}`;

        expect(combined).toContain("Automated objective records");
        expect(combined).toContain("clinician-authored notes");
        expect(combined).toContain("intentionally separated");
        expect(combined).toContain(
            "Notes do not rewrite model, feature, quality, or interpretation records",
        );
    });

    it("keeps notes static and non-persistent in Stage 12 closeout", () => {
        const combined =
            `${read(notesLib)}\n${read(notesComponent)}`.toLowerCase();

        expect(combined).toContain("static clinician-only placeholder");
        expect(combined).toContain("does not save notes");

        for (const forbidden of [
            "onsubmit",
            "form action",
            "create note",
            "post note",
            "patch note",
            "delete note",
            "notes api",
            "clinician_notes insert",
            "save clinician note",
            "persist clinician note",
        ]) {
            expect(combined).not.toContain(forbidden);
        }
    });

    it("does not add note APIs, history UI fetches, or backend coupling to dashboard files", () => {
        const files = collectFiles(routeRoot).filter((file) =>
            /\.(ts|tsx)$/.test(file),
        );

        for (const file of files) {
            const content = read(file);

            expectNoMatch(content, /\bfetch\s*\(/, file);
            expectNoMatch(content, /new\s+WebSocket/, file);
            expectNoMatch(content, /EventSource/, file);
            expectNoMatch(content, /\/api\/objective\/history/, file);
            expectNoMatch(content, /\/api\/objective\/notes/, file);
            expectNoMatch(content, /clinician_notes/, file);
            expectNoMatch(content, /services\/objective-backend/, file);
        }
    });

    it("keeps notes and summaries free of forbidden clinical summaries", () => {
        const combined =
            `${read(notesLib)}\n${read(notesComponent)}`.toLowerCase();

        for (const forbidden of [
            "relapse risk summary",
            "withdrawal concern summary",
            "withdrawal risk summary",
            "intoxication summary",
            "craving summary",
            "clinical alert summary",
            "treatment-need score",
            "treatment need score",
            "risk score",
            "diagnosis",
            "ciwa",
            "sobriety",
            "patient is safe",
            "patient is stable",
            "patient is lying",
        ]) {
            expect(combined).not.toContain(forbidden);
        }
    });

    it("still does not create patient or chatbot objective routes", () => {
        for (const forbiddenRoute of [
            appPath("patient", "objective"),
            appPath("chat", "physiology"),
            appPath("chat", "objective-context"),
        ]) {
            if (fs.existsSync(forbiddenRoute)) {
                throw new Error(`${forbiddenRoute} should not exist`);
            }
        }
    });
});
