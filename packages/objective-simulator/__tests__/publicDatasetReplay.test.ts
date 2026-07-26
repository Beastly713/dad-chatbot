import {
  FORBIDDEN_OBJECTIVE_FIELD_NAMES,
  FORBIDDEN_OBJECTIVE_LABELS,
  FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS,
  findForbiddenObjectiveTermViolations
} from "@dad-chatbot/objective-safety";
import {
  OBJECTIVE_PUBLIC_DATASET_REPLAY_KEYS,
  OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE,
  createObjectivePublicDatasetReplayPlan,
  getObjectivePublicDatasetReplayProfile,
  listObjectivePublicDatasetReplayProfiles,
  resolveObjectivePublicDatasetReplayAccess
} from "../src/index.js";

function expectClinicianOnlyVisibility(value: {
  clinician_visible: boolean;
  patient_visible: boolean;
  chatbot_visible: boolean;
  developer_labels_visible: boolean;
}): void {
  expect(value).toEqual({
    clinician_visible: true,
    patient_visible: false,
    chatbot_visible: false,
    developer_labels_visible: false
  });
}

function expectNoForbiddenObjectiveTerms(value: unknown): void {
  const serialized = JSON.stringify(value);

  for (const forbidden of [
    ...FORBIDDEN_OBJECTIVE_LABELS,
    ...FORBIDDEN_OBJECTIVE_FIELD_NAMES,
    ...FORBIDDEN_OBJECTIVE_ROUTE_SEGMENTS
  ]) {
    expect(serialized).not.toContain(forbidden);
  }

  expect(serialized).not.toContain("diagnosis");
  expect(serialized).not.toContain("risk_score");
  expect(serialized).not.toContain("ground_truth");

  const violations = findForbiddenObjectiveTermViolations([
    {
      path: "packages/objective-simulator/src/publicDatasetReplay.ts",
      surface: "source",
      content: serialized
    }
  ]);

  expect(violations).toEqual([]);
}

describe("public dataset replay adapter skeleton", () => {
  it("declares bounded public dataset replay keys and source type", () => {
    expect(OBJECTIVE_PUBLIC_DATASET_REPLAY_SOURCE_TYPE).toBe(
      "public_dataset_replay"
    );
    expect(OBJECTIVE_PUBLIC_DATASET_REPLAY_KEYS).toEqual([
      "wesad",
      "case",
      "ppg_dalia"
    ]);
  });

  it("lists skeleton profiles with source banners and no validation claim", () => {
    const profiles = listObjectivePublicDatasetReplayProfiles();

    expect(profiles.map((profile) => profile.dataset_key)).toEqual([
      "wesad",
      "case",
      "ppg_dalia"
    ]);

    for (const profile of profiles) {
      expect(profile.source_type).toBe("public_dataset_replay");
      expect(profile.schema_version).toBe(
        "objective-public-dataset-replay-adapter-v1"
      );
      expect(profile.source_metadata).toEqual(
        expect.objectContaining({
          source_type: "public_dataset_replay",
          dataset_key: profile.dataset_key,
          adapter_status: "skeleton_only",
          engineering_only: true,
          replay_preparation_only: true,
          local_dataset_required: true,
          local_dataset_available: false,
          dataset_files_bundled: false,
          automatic_download_enabled: false,
          network_fetch_enabled: false,
          clinical_validation_claim: false
        })
      );
      expect(profile.source_metadata.source_banner).toContain(
        "public dataset replay adapter skeleton"
      );
      expect(profile.source_metadata.source_banner).toContain(
        "engineering replay preparation only"
      );
      expectClinicianOnlyVisibility(profile.visibility);
      expectNoForbiddenObjectiveTerms(profile);
    }
  });

  it("returns defensive copies of replay profiles", () => {
    const profile = getObjectivePublicDatasetReplayProfile("wesad");
    profile.source_metadata.source_banner = "mutated locally";

    expect(getObjectivePublicDatasetReplayProfile("wesad").source_metadata)
      .toHaveProperty(
        "source_banner",
        expect.stringContaining("public dataset replay adapter skeleton")
      );
  });

  it("fails closed for unsupported dataset keys", () => {
    expect(() =>
      getObjectivePublicDatasetReplayProfile("unknown_dataset")
    ).toThrow("Unsupported objective public dataset replay key");

    expect(() =>
      createObjectivePublicDatasetReplayPlan("unknown_dataset")
    ).toThrow("Unsupported objective public dataset replay key");
  });

  it("denies patient and chatbot roles and limits adapter preparation to developer or service actors", () => {
    expect(resolveObjectivePublicDatasetReplayAccess("patient")).toEqual({
      allowed: false,
      code: "objective_public_dataset_replay_patient_denied",
      message: "Public dataset replay preparation is not available to patients."
    });

    expect(resolveObjectivePublicDatasetReplayAccess("chatbot")).toEqual({
      allowed: false,
      code: "objective_public_dataset_replay_chatbot_denied",
      message:
        "Public dataset replay preparation is not available to chatbot flows."
    });

    expect(resolveObjectivePublicDatasetReplayAccess("clinician")).toEqual({
      allowed: false,
      code: "objective_public_dataset_replay_role_required",
      message:
        "Public dataset replay preparation requires a developer or service actor."
    });

    expect(resolveObjectivePublicDatasetReplayAccess("developer")).toEqual({
      allowed: true,
      role: "developer"
    });

    expect(resolveObjectivePublicDatasetReplayAccess("service")).toEqual({
      allowed: true,
      role: "service"
    });
  });

  it("creates a skeleton replay plan without generating frames or batches", () => {
    const plan = createObjectivePublicDatasetReplayPlan("ppg_dalia");

    expect(plan).toEqual(
      expect.objectContaining({
        schema_version: "objective-public-dataset-replay-adapter-v1",
        dataset_key: "ppg_dalia",
        source_type: "public_dataset_replay",
        prepared: false,
        reason: "local_dataset_adapter_not_implemented",
        generated_frame_count: 0,
        prepared_batch_count: 0
      })
    );

    expect(plan).not.toHaveProperty("frames");
    expect(plan).not.toHaveProperty("batches");
    expect(plan.source_metadata).toEqual(
      expect.objectContaining({
        local_dataset_required: true,
        local_dataset_available: false,
        dataset_files_bundled: false,
        automatic_download_enabled: false,
        network_fetch_enabled: false,
        clinical_validation_claim: false
      })
    );
    expectClinicianOnlyVisibility(plan.visibility);
    expectNoForbiddenObjectiveTerms(plan);
  });

  it("does not introduce network fetches, bundled dataset files, or forbidden clinical labels", () => {
    const serialized = JSON.stringify({
      profiles: listObjectivePublicDatasetReplayProfiles(),
      plans: OBJECTIVE_PUBLIC_DATASET_REPLAY_KEYS.map((datasetKey) =>
        createObjectivePublicDatasetReplayPlan(datasetKey)
      )
    });

    expect(serialized).not.toContain("fetch(");
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("download_url");
    expect(serialized).not.toContain("participant_id");
    expect(serialized).not.toContain("\"label\"");
    expectNoForbiddenObjectiveTerms(serialized);
  });
});
