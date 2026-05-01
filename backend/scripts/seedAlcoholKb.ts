import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { makeRetriever } from "../src/shared/retrieval.js";
import {
  ALCOHOL_PHASE1_KB_VERSION,
  alcoholPhase1Docs,
} from "../src/kb/seed/alcoholPhase1.js";

dotenv.config();

async function deleteExistingPhase1KbRows(): Promise<number | null> {
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
    .eq("metadata->>version", ALCOHOL_PHASE1_KB_VERSION)
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
    `Preparing to seed ${alcoholPhase1Docs.length} alcohol KB documents...`,
  );

  const deletedCount = await deleteExistingPhase1KbRows();

  if (deletedCount !== null) {
    console.info(
      `Deleted ${deletedCount} existing ${ALCOHOL_PHASE1_KB_VERSION} alcohol KB rows.`,
    );
  }

  const retriever = await makeRetriever({
    configurable: {
      retrieverProvider: "supabase",
      k: 4,
      filterKwargs: {},
    },
  });

  await retriever.addDocuments(alcoholPhase1Docs);

  console.info(
    `Seeded ${alcoholPhase1Docs.length} alcohol KB documents with version ${ALCOHOL_PHASE1_KB_VERSION}.`,
  );
}

seedAlcoholKb().catch((error) => {
  console.error("Failed to seed alcohol KB:", error);
  process.exitCode = 1;
});