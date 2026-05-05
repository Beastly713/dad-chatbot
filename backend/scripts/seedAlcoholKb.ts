import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { makeRetriever } from "../src/shared/retrieval.js";
import {
  ALCOHOL_PHASE1_KB_VERSION,
  alcoholPhase1Docs,
} from "../src/kb/seed/alcoholPhase1.js";
import {
  ALCOHOL_PHASE2_KB_VERSION,
  alcoholPhase2Docs,
} from "../src/kb/seed/alcoholPhase2.js";

dotenv.config();

const ALCOHOL_KB_VERSIONS = [
  ALCOHOL_PHASE1_KB_VERSION,
  ALCOHOL_PHASE2_KB_VERSION,
];

const allAlcoholKbDocs = [...alcoholPhase1Docs, ...alcoholPhase2Docs];

async function deleteExistingAlcoholKbRows(): Promise<number | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not defined",
    );
  }

  const supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data, error } = await supabaseClient
    .from("documents")
    .delete()
    .eq("metadata->>source", "internal_kb")
    .eq("metadata->>substance", "alcohol")
    .in("metadata->>version", ALCOHOL_KB_VERSIONS)
    .select("id");

  if (error) {
    throw error;
  }

  return data?.length ?? null;
}

async function seedAlcoholKb(): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  console.info(
    `Preparing to seed ${allAlcoholKbDocs.length} alcohol KB documents...`,
  );

  const deletedCount = await deleteExistingAlcoholKbRows();

  if (deletedCount !== null) {
    console.info(
      `Deleted ${deletedCount} existing alcohol KB rows for versions: ${ALCOHOL_KB_VERSIONS.join(
        ", ",
      )}.`,
    );
  }

  const retriever = await makeRetriever({
    configurable: {
      retrieverProvider: "supabase",
      k: 4,
      filterKwargs: {},
    },
  });

  await retriever.addDocuments(allAlcoholKbDocs);

  console.info(
    `Seeded ${allAlcoholKbDocs.length} alcohol KB documents across versions: ${ALCOHOL_KB_VERSIONS.join(
      ", ",
    )}.`,
  );
}

seedAlcoholKb().catch((error) => {
  console.error("Failed to seed alcohol KB:", error);
  process.exitCode = 1;
});