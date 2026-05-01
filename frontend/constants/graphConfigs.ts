import { AgentConfiguration, IndexConfiguration } from '@/types/graphTypes';

type StreamConfigurables = AgentConfiguration;
type IndexConfigurables = IndexConfiguration;

/**
 * Default retrieval config for Phase 1.
 *
 * The backend graph applies category-specific KB filters based on deterministic
 * triage. These frontend defaults are only broad internal-KB constraints.
 */
export const retrievalAssistantStreamConfig: StreamConfigurables = {
  queryModel: 'openrouter/openai/gpt-4o-mini',
  retrieverProvider: 'supabase',
  k: 4,
  filterKwargs: {
    source: 'internal_kb',
    substance: 'alcohol',
    userVisible: true,
    approved: true,
  },
};

/**
 * The configuration for the indexing/ingestion process.
 *
 * Kept for developer-controlled ingestion/KB work. User-uploaded documents are
 * no longer the main Phase 1 chat grounding path.
 */
export const indexConfig: IndexConfigurables = {
  useSampleDocs: false,
  retrieverProvider: 'supabase',
};