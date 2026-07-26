import fs from "fs";
import path from "path";
import {
    createInMemoryObjectiveAuditLogger,
    type ObjectiveAuditRecord,
} from "../src/audit.js";
import {
    requireAssignedClinician,
    type ObjectiveAssignmentLookup,
} from "../src/assignments.js";
import {
    parseObjectiveActorFromHeaders,
    type ObjectiveActor,
} from "../src/auth.js";
import { failClosedFromGuard } from "../src/failClosed.js";
import {
    createObjectiveSessionHistoryRepositoryFromSessions,
    getObjectiveSessionHistoryDetail,
    listObjectiveSessionHistoryForPatient,
} from "../src/sessionHistory.js";
import {
    createObjectiveSession,
    InMemoryObjectiveSessionRepository,
    requireSessionAccess,
    updateObjectiveSessionLifecycle,
    type ObjectiveSessionRecord,
} from "../src/sessionLifecycle.js";
import { serializeObjectiveClinicianStreamEvent } from "../src/streamEvents.js";
import {
    generateObjectiveStreamToken,
    validateObjectiveStreamToken,
} from "../src/streamTokens.js";
import type { ObjectiveTraceContext } from "../src/trace.js";

const PATIENT_ID = "patient-stage14-rbac";
const OTHER_PATIENT_ID = "patient-stage14-other";
const CLINICIAN_ID = "clinician-stage14-rbac";
const ASSIGNMENT_ID = "assignment-stage14-rbac";
const SECRET = "objective-stream-token-stage14-secret-32-chars";

const trace: ObjectiveTraceContext = {
    requestId: "stage14-rbac-request",
    traceId: "stage14-rbac-trace",
};

const clinicianActor: ObjectiveActor = {
    actorId: CLINICIAN_ID,
    role: "clinician",
};

const serviceActor: ObjectiveActor = {
    actorId: "service-stage14-rbac",
    role: "service",
};

const developerActor: ObjectiveActor = {
    actorId: "developer-stage14-rbac",
    role: "developer",
};

type MutableAssignmentState = {
    active: boolean;
    clinicianId?: string;
    patientId?: string;
    assignmentId?: string;
};

function fixedNow(): Date {
    return new Date("2026-06-02T12:00:00.000Z");
}

function makeMutableAssignments(
    state: MutableAssignmentState = {
        active: true,
    },
): ObjectiveAssignmentLookup {
    return {
        async findActiveAssignment(clinicianId: string, patientId: string) {
            const expectedClinicianId = state.clinicianId ?? CLINICIAN_ID;
            const expectedPatientId = state.patientId ?? PATIENT_ID;

            if (
                !state.active ||
                clinicianId !== expectedClinicianId ||
                patientId !== expectedPatientId
            ) {
                return null;
            }

            return {
                assignmentId: state.assignmentId ?? ASSIGNMENT_ID,
                clinicianId,
                patientId,
                status: "active",
            };
        },
    };
}

function expectClinicianOnlyVisibility(value: {
    clinician_visible: boolean;
    patient_visible: boolean;
    chatbot_visible: boolean;
}): void {
    expect({
        clinician_visible: value.clinician_visible,
        patient_visible: value.patient_visible,
        chatbot_visible: value.chatbot_visible,
    }).toEqual({
        clinician_visible: true,
        patient_visible: false,
        chatbot_visible: false,
    });
}

function expectNoUnsafeAccessSurface(value: unknown): void {
    const serialized = JSON.stringify(value).toLowerCase();

    for (const forbidden of [
        "raw_payload",
        "rawpayload",
        "raw_frame",
        "rawframe",
        "raw_frames",
        "rawframes",
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
        "developer_labels",
        "synthetic_ground_truth",
        "ground_truth",
        "craving_detected",
        "relapse_risk",
        "withdrawal_risk",
        "intoxication_detected",
        "aud_severity",
        "emergency_detected",
        "treatment_need",
        "detox_need",
        "medication_need",
        "ciwa_score",
        "sobriety_status",
        "patient_truthfulness",
        "patient_is_lying",
        "patient_is_safe",
        "patient_is_stable",
        "stress_proven",
        "chatbot_visible\":true",
        "patient_visible\":true",
    ]) {
        expect(serialized).not.toContain(forbidden);
    }
}

async function createStoppedSimulatorSession(
    sessions: InMemoryObjectiveSessionRepository,
): Promise<ObjectiveSessionRecord> {
    const created = await createObjectiveSession(
        serviceActor,
        {
            patient_id: PATIENT_ID,
            source_type: "simulator",
            device_id: "device-stage14-rbac",
            device_boot_id: "boot-stage14-rbac",
        },
        {
            sessions,
            assignments: makeMutableAssignments({ active: false }),
            now: fixedNow,
        },
        trace,
    );

    if (!created.allowed) {
        throw new Error(`Expected service session creation to succeed: ${created.code}`);
    }

    const started = await updateObjectiveSessionLifecycle(
        serviceActor,
        created.value.session_id,
        "start",
        {
            sessions,
            assignments: makeMutableAssignments({ active: false }),
            now: () => new Date("2026-06-02T12:00:01.000Z"),
        },
        trace,
    );

    if (!started.allowed) {
        throw new Error(`Expected service session start to succeed: ${started.code}`);
    }

    const stopped = await updateObjectiveSessionLifecycle(
        serviceActor,
        created.value.session_id,
        "stop",
        {
            sessions,
            assignments: makeMutableAssignments({ active: false }),
            now: () => new Date("2026-06-02T12:02:01.000Z"),
        },
        trace,
    );

    if (!stopped.allowed) {
        throw new Error(`Expected service session stop to succeed: ${stopped.code}`);
    }

    return stopped.value;
}

function findRepoRoot(): string {
    let current = process.cwd();

    for (let depth = 0; depth < 8; depth += 1) {
        if (
            fs.existsSync(path.join(current, "package.json")) &&
            fs.existsSync(path.join(current, "turbo.json"))
        ) {
            return current;
        }

        const parent = path.dirname(current);

        if (parent === current) {
            break;
        }

        current = parent;
    }

    throw new Error(`Could not locate repo root from cwd: ${process.cwd()}`);
}

function readAllMigrationSql(): string {
    const repoRoot = findRepoRoot();
    const migrationsDir = path.join(repoRoot, "supabase", "migrations");

    if (!fs.existsSync(migrationsDir)) {
        throw new Error("supabase/migrations directory is required for RBAC/RLS release test");
    }

    return fs
        .readdirSync(migrationsDir)
        .filter((entry) => entry.endsWith(".sql"))
        .sort()
        .map((entry) =>
            fs.readFileSync(path.join(migrationsDir, entry), "utf8"),
        )
        .join("\n\n");
}

function expectAuditRecordsAreSafe(records: readonly ObjectiveAuditRecord[]): void {
    expect(records.length).toBeGreaterThan(0);
    expectNoUnsafeAccessSurface(records);

    for (const record of records) {
        expect(record.request_id).toBe(trace.requestId);
        expect(record.trace_id).toBe(trace.traceId);
        expect(record.metadata).toEqual(expect.any(Object));
    }
}

describe("Stage 14 RBAC/RLS/access-control release suite", () => {
    it("denies patient, chatbot, missing auth, and unsupported roles with fail-closed safe errors", () => {
        const deniedCases = [
            {
                name: "patient",
                headers: {
                    "x-objective-role": "patient",
                    "x-objective-actor-id": "patient-stage14-rbac",
                },
                expectedStatus: 403,
                expectedCode: "objective_patient_denied",
            },
            {
                name: "chatbot",
                headers: {
                    "x-objective-role": "chatbot",
                    "x-objective-actor-id": "chatbot-stage14-rbac",
                },
                expectedStatus: 403,
                expectedCode: "objective_chatbot_denied",
            },
            {
                name: "missing auth",
                headers: {},
                expectedStatus: 401,
                expectedCode: "objective_missing_auth",
            },
            {
                name: "unsupported role",
                headers: {
                    "x-objective-role": "researcher",
                    "x-objective-actor-id": "researcher-stage14-rbac",
                },
                expectedStatus: 403,
                expectedCode: "objective_unsupported_role",
            },
        ] as const;

        for (const testCase of deniedCases) {
            const result = parseObjectiveActorFromHeaders(testCase.headers, trace);

            expect(result.allowed).toBe(false);

            const failed = failClosedFromGuard(result, trace);

            expect(failed).not.toBeNull();
            expect(failed?.statusCode).toBe(testCase.expectedStatus);
            expect(JSON.stringify(failed?.body)).toContain(testCase.expectedCode);
            expectNoUnsafeAccessSurface({
                case: testCase.name,
                result,
                failed,
            });
        }
    });

    it("allows assigned clinician access and denies unassigned or revoked assignments", async () => {
        const assignmentState: MutableAssignmentState = {
            active: true,
            clinicianId: CLINICIAN_ID,
            patientId: PATIENT_ID,
            assignmentId: ASSIGNMENT_ID,
        };
        const assignments = makeMutableAssignments(assignmentState);
        const sessions = new InMemoryObjectiveSessionRepository(fixedNow);
        const session = await createStoppedSimulatorSession(sessions);

        const assignedAccess = await requireSessionAccess(
            clinicianActor,
            session.session_id,
            {
                sessions,
                assignments,
                now: fixedNow,
            },
            trace,
        );

        expect(assignedAccess.allowed).toBe(true);
        if (!assignedAccess.allowed) {
            throw new Error("Expected assigned clinician session access");
        }

        expect(assignedAccess.value.assignment?.assignmentId).toBe(ASSIGNMENT_ID);
        expectClinicianOnlyVisibility(assignedAccess.value.session);

        const historyRepository =
            createObjectiveSessionHistoryRepositoryFromSessions(sessions);
        const listed = await listObjectiveSessionHistoryForPatient(
            historyRepository,
            PATIENT_ID,
            fixedNow,
        );
        const detail = await getObjectiveSessionHistoryDetail(
            historyRepository,
            session.session_id,
            fixedNow,
        );

        expect(listed).toHaveLength(1);
        expect(detail?.visibility).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });
        expectNoUnsafeAccessSurface({ listed, detail });

        const wrongPatientAccess = await requireAssignedClinician(
            clinicianActor,
            OTHER_PATIENT_ID,
            assignments,
            trace,
        );

        expect(wrongPatientAccess.allowed).toBe(false);
        if (wrongPatientAccess.allowed) {
            throw new Error("Expected wrong-patient assignment denial");
        }
        expect(wrongPatientAccess.code).toBe("objective_assignment_required");

        assignmentState.active = false;

        const revokedAccess = await requireSessionAccess(
            clinicianActor,
            session.session_id,
            {
                sessions,
                assignments,
                now: fixedNow,
            },
            trace,
        );

        expect(revokedAccess.allowed).toBe(false);
        if (revokedAccess.allowed) {
            throw new Error("Expected revoked assignment denial");
        }
        expect(revokedAccess.code).toBe("objective_assignment_required");

        const { logger, sink } = createInMemoryObjectiveAuditLogger();
        if (revokedAccess.auditEvent) {
            await logger.recordAccessDenied(revokedAccess.auditEvent);
        }

        expectAuditRecordsAreSafe(sink.getRecords());
        expect(sink.getRecords()).toEqual([
            expect.objectContaining({
                event_type: "access_denied",
                actor_id: CLINICIAN_ID,
                actor_role: "clinician",
                patient_id: PATIENT_ID,
                metadata: {
                    reason: "unassigned_clinician",
                },
            }),
        ]);
    });

    it("scopes service identity to simulator/service behavior and keeps developer/debug isolated", async () => {
        const sessions = new InMemoryObjectiveSessionRepository(fixedNow);

        const simulatorSession = await createStoppedSimulatorSession(sessions);
        const serviceSimulatorAccess = await requireSessionAccess(
            serviceActor,
            simulatorSession.session_id,
            {
                sessions,
                assignments: makeMutableAssignments({ active: false }),
                now: fixedNow,
            },
            trace,
        );

        expect(serviceSimulatorAccess.allowed).toBe(true);
        if (!serviceSimulatorAccess.allowed) {
            throw new Error("Expected service access to simulator session");
        }
        expect(serviceSimulatorAccess.value.assignment).toBeUndefined();
        expectClinicianOnlyVisibility(serviceSimulatorAccess.value.session);

        const publicReplaySession = await sessions.createSession({
            patient_id: PATIENT_ID,
            source_type: "public_dataset_replay",
            device_id: "dataset-device-stage14",
            device_boot_id: "dataset-boot-stage14",
        });

        const serviceReplayAccess = await requireSessionAccess(
            serviceActor,
            publicReplaySession.session_id,
            {
                sessions,
                assignments: makeMutableAssignments({ active: false }),
                now: fixedNow,
            },
            trace,
        );

        expect(serviceReplayAccess.allowed).toBe(false);
        if (serviceReplayAccess.allowed) {
            throw new Error("Expected service denial for non-simulator session");
        }
        expect(serviceReplayAccess.code).toBe("objective_service_session_denied");

        const serviceClinicianSurfaceAccess = await requireAssignedClinician(
            serviceActor,
            PATIENT_ID,
            makeMutableAssignments({ active: true }),
            trace,
        );

        expect(serviceClinicianSurfaceAccess.allowed).toBe(false);
        if (serviceClinicianSurfaceAccess.allowed) {
            throw new Error("Expected service denial for clinician patient-scoped access");
        }
        expect(serviceClinicianSurfaceAccess.code).toBe(
            "objective_clinician_required",
        );

        const developerClinicianSurfaceAccess = await requireAssignedClinician(
            developerActor,
            PATIENT_ID,
            makeMutableAssignments({ active: true }),
            trace,
        );

        expect(developerClinicianSurfaceAccess.allowed).toBe(false);
        if (developerClinicianSurfaceAccess.allowed) {
            throw new Error("Expected developer denial for clinician patient-scoped access");
        }
        expect(developerClinicianSurfaceAccess.code).toBe(
            "objective_clinician_required",
        );

        const developerCreate = await createObjectiveSession(
            developerActor,
            {
                patient_id: PATIENT_ID,
                source_type: "simulator",
            },
            {
                sessions,
                assignments: makeMutableAssignments({ active: true }),
                now: fixedNow,
            },
            trace,
        );

        expect(developerCreate.allowed).toBe(false);
        expectNoUnsafeAccessSurface({
            serviceReplayAccess,
            serviceClinicianSurfaceAccess,
            developerClinicianSurfaceAccess,
            developerCreate,
        });
    });

    it("issues assigned-clinician stream tokens, rejects expired tokens, and blocks revoked assignment token issuance", async () => {
        const assignmentState: MutableAssignmentState = {
            active: true,
            clinicianId: CLINICIAN_ID,
            patientId: PATIENT_ID,
            assignmentId: ASSIGNMENT_ID,
        };
        const assignments = makeMutableAssignments(assignmentState);

        const issued = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: PATIENT_ID,
            sessionId: "session-stage14-rbac",
            assignmentLookup: assignments,
            trace,
            secret: SECRET,
            nowMs: 1_000,
            ttlMs: 1_000,
            allowedEventScopes: ["heartbeat", "interpretation.record"],
        });

        expect(issued.allowed).toBe(true);
        if (!issued.allowed) {
            throw new Error(`Expected stream token issuance: ${issued.code}`);
        }

        expect(issued.value.payload).toEqual(
            expect.objectContaining({
                actor_role: "clinician",
                clinician_id: CLINICIAN_ID,
                patient_id: PATIENT_ID,
                session_id: "session-stage14-rbac",
                assignment_id: ASSIGNMENT_ID,
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        );

        const valid = validateObjectiveStreamToken({
            token: issued.value.token,
            secret: SECRET,
            nowMs: 1_500,
            expected: {
                clinicianId: CLINICIAN_ID,
                patientId: PATIENT_ID,
                sessionId: "session-stage14-rbac",
                assignmentId: ASSIGNMENT_ID,
                requiredEventScope: "heartbeat",
            },
        });

        expect(valid.valid).toBe(true);
        if (!valid.valid) {
            throw new Error(`Expected stream token validation: ${valid.code}`);
        }

        const expired = validateObjectiveStreamToken({
            token: issued.value.token,
            secret: SECRET,
            nowMs: 2_001,
            expected: {
                clinicianId: CLINICIAN_ID,
                patientId: PATIENT_ID,
                sessionId: "session-stage14-rbac",
            },
        });

        expect(expired.valid).toBe(false);
        if (expired.valid) {
            throw new Error("Expected expired token denial");
        }
        expect(expired.code).toBe("objective_stream_token_expired");

        assignmentState.active = false;

        const revokedIssue = await generateObjectiveStreamToken({
            actor: clinicianActor,
            patientId: PATIENT_ID,
            sessionId: "session-stage14-rbac",
            assignmentLookup: assignments,
            trace,
            secret: SECRET,
            nowMs: 3_000,
        });

        expect(revokedIssue.allowed).toBe(false);
        if (revokedIssue.allowed) {
            throw new Error("Expected revoked assignment token issuance denial");
        }
        expect(revokedIssue.code).toBe("objective_assignment_required");

        expectNoUnsafeAccessSurface({
            issued: issued.value.payload,
            auditMetadata: issued.value.auditMetadata,
            valid,
            expired,
            revokedIssue,
        });
    });

    it("keeps audit metadata safe and rejects raw physiological or sensitive free-text metadata", async () => {
        const { logger, sink } = createInMemoryObjectiveAuditLogger();

        await logger.record({
            eventType: "access_denied",
            actorId: CLINICIAN_ID,
            actorRole: "clinician",
            patientId: PATIENT_ID,
            trace,
            metadata: {
                reason: "unassigned_clinician",
                route_family: "history",
                denied: true,
            },
            occurredAt: fixedNow(),
        });

        expectAuditRecordsAreSafe(sink.getRecords());

        await expect(
            logger.record({
                eventType: "access_denied",
                actorId: CLINICIAN_ID,
                actorRole: "clinician",
                patientId: PATIENT_ID,
                trace,
                metadata: {
                    ecg_raw: 3012,
                },
            }),
        ).rejects.toThrow("Unsafe audit metadata key");

        await expect(
            logger.record({
                eventType: "access_denied",
                actorId: CLINICIAN_ID,
                actorRole: "clinician",
                patientId: PATIENT_ID,
                trace,
                metadata: {
                    prompt: "unsafe sensitive free text should not be logged",
                },
            }),
        ).rejects.toThrow("Unsafe audit metadata key");
    });

    it("keeps synthetic ground truth and developer-only labels out of clinician stream payloads", () => {
        expect(() =>
            serializeObjectiveClinicianStreamEvent({
                event_id: "event-stage14-rbac-1",
                event_type: "quality.update",
                session_id: "session-stage14-rbac",
                emitted_at: "2026-06-02T12:00:00.000Z",
                payload: {
                    synthetic_ground_truth: "relapse_risk_high",
                },
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            }),
        ).toThrow("Unsafe stream payload key");

        expect(() =>
            serializeObjectiveClinicianStreamEvent({
                event_id: "event-stage14-rbac-2",
                event_type: "quality.update",
                session_id: "session-stage14-rbac",
                emitted_at: "2026-06-02T12:00:00.000Z",
                payload: {
                    developer_labels: {
                        craving_detected: true,
                    },
                },
                visibility: {
                    clinician_visible: true,
                    patient_visible: false,
                    chatbot_visible: false,
                },
            }),
        ).toThrow("Unsafe stream payload key");
    });

    it("keeps static SQL/RLS migration coverage aligned with objective access-control invariants", () => {
        const sql = readAllMigrationSql();
        const lower = sql.toLowerCase();
        const unsafeLabelScanSql = lower.replaceAll("developer_labels_visible", "");

        expect(lower).toContain("enable row level security");
        expect(lower).toContain("create policy");
        expect(lower).toContain("clinician_patient_assignments");
        expect(lower).toContain("patient_visible");
        expect(lower).toContain("chatbot_visible");
        expect(lower).toContain("clinician");

        for (const forbidden of [
            "craving_detected",
            "relapse_risk",
            "withdrawal_risk",
            "intoxication_detected",
            "aud_severity",
            "emergency_detected",
            "treatment_need",
            "detox_need",
            "medication_need",
            "ciwa_score",
            "sobriety_status",
            "patient_truthfulness",
            "patient_is_lying",
            "patient_is_safe",
            "patient_is_stable",
            "stress_proven",
            "synthetic_ground_truth",
            "developer_labels",
        ]) {
            expect(unsafeLabelScanSql).not.toContain(forbidden);
        }
    });
});
