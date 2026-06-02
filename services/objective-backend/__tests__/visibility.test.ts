import {
    assertObjectiveRecordClinicianOnly,
    serializeClinicianObjectiveRecord,
    stripDeveloperOnlyFields,
} from "../src/visibility.js";

describe("objective backend visibility serializers", () => {
    it("accepts clinician-only objective records", () => {
        expect(
            assertObjectiveRecordClinicianOnly({
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            }),
        ).toEqual({
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });
    });

    it("rejects patient-visible or chatbot-visible records", () => {
        expect(() =>
            assertObjectiveRecordClinicianOnly({
                clinician_visible: true,
                patient_visible: true,
                chatbot_visible: false,
            }),
        ).toThrow("Invalid objective visibility flags");

        expect(() =>
            assertObjectiveRecordClinicianOnly({
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: true,
            }),
        ).toThrow("Invalid objective visibility flags");
    });

    it("serializes clinician records while removing visibility implementation fields", () => {
        const serialized = serializeClinicianObjectiveRecord({
            id: "record-1",
            label: "elevated_physiological_arousal_evidence",
            clinician_visible: true,
            patient_visible: false,
            chatbot_visible: false,
        });

        expect(serialized).toEqual({
            id: "record-1",
            label: "elevated_physiological_arousal_evidence",
            visibility: {
                clinician_visible: true,
                patient_visible: false,
                chatbot_visible: false,
            },
        });

        expect(serialized).not.toHaveProperty("patient_visible");
        expect(serialized).not.toHaveProperty("chatbot_visible");
    });

    it("strips developer-only fields recursively", () => {
        const stripped = stripDeveloperOnlyFields({
            id: "record-1",
            developer_only: true,
            synthetic_ground_truth: "hidden",
            nested: {
                developer_labels: ["hidden"],
                safe: "visible",
            },
            rows: [
                {
                    developer_visible: true,
                    value: 1,
                },
            ],
        });

        expect(stripped).toEqual({
            id: "record-1",
            nested: {
                safe: "visible",
            },
            rows: [
                {
                    value: 1,
                },
            ],
        });
    });
});
