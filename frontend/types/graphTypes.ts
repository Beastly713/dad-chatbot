import { Document } from '@langchain/core/documents';

/**
 * Represents the state of the retrieval graph / agent.
 */
export type documentType =
  | PDFDocument[]
  | { [key: string]: any }[]
  | string[]
  | string
  | 'delete';
export interface AgentState {
  query?: string;
  route?: string;
  messages: Array<{
    content: string;
    additional_kwargs: Record<string, any>;
    response_metadata: Record<string, any>;
    id: string;
    type: 'human' | 'assistant';
  }>;
  documents: documentType;
}

export interface RetrieveDocumentsNodeUpdates {
  retrieveDocuments: {
    documents: documentType;
  };
}

export type PDFDocument = Document & {
  metadata?: {
    loc?: {
      lines?: {
        from: number;
        to: number;
      };
      pageNumber?: number;
    };
    pdf?: {
      info?: {
        Title?: string;
        Creator?: string;
        Producer?: string;
        CreationDate?: string;
        IsXFAPresent?: boolean;
        PDFFormatVersion?: string;
        IsAcroFormPresent?: boolean;
      };
      version?: string;
      metadata?: any;
      totalPages?: number;
    };
    uuid?: string;
    source?: string;
  };
};

export interface BaseConfiguration {
  /**
   * The vector store provider to use for retrieval.
   * @default 'supabase'
   */
  retrieverProvider?: 'supabase';

  /**
   * Additional keyword arguments to pass to the search function of the retriever for filtering.
   * @default {}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterKwargs?: Record<string, any>;

  /**
   * The number of documents to retrieve.
   * @default 5
   */
  k?: number;
}

export interface AgentConfiguration extends BaseConfiguration {
  // models
  /**
   * The language model used for processing and refining queries.
   * Should be in the form: provider/model-name.
   */
  queryModel?: string;
}

export interface IndexConfiguration extends BaseConfiguration {
  /**
   * Path to a JSON file containing default documents to index.
   */
  docsFile?: string;

  /**
   * Whether to use sample documents for indexing.
   */
  useSampleDocs?: boolean;
}

export type SubjectiveCheckInField =
  | "craving_level"
  | "distress_level"
  | "coping_confidence"
  | "alcohol_availability"
  | "support_preference"
  | "recent_use_status"
  | "social_context"
  | "trigger_context";

export type SubjectiveCheckInOption = {
  label: string;
  value: string;
};

export type SubjectiveCheckInQuestion = {
  field: SubjectiveCheckInField;
  prompt: string;
  helperText?: string;
  inputType: "chips" | "text";
  options?: SubjectiveCheckInOption[];
  required: boolean;
  allowSkip: boolean;
};

export type SubjectiveCheckInRequest = {
  requestId: string;
  substance: "alcohol" | string;
  questions: SubjectiveCheckInQuestion[];
  reason: string;
  createdAt: string;
};

export type SubjectiveCheckInAnswerValue = string | number | boolean | null;

export type SubjectiveCheckInResponse = {
  requestId: string;
  answers: Partial<Record<SubjectiveCheckInField, SubjectiveCheckInAnswerValue>>;
  skippedFields: SubjectiveCheckInField[] | ["all"];
  submittedAt: string;
};

export type SubjectiveUIAction =
  | {
      type: "subjective_checkin";
      request: SubjectiveCheckInRequest;
    }
  | null;

export type UIActionUpdate = SubjectiveUIAction;

export type ChatClientMeta = {
  source?: "chat_input" | "micro_checkin" | "skip_action";
};

export type ChatRequestPayload = {
  message?: string;
  threadId?: string;
  checkInResponse?: SubjectiveCheckInResponse | null;
  clientMeta?: ChatClientMeta;
};

export type Phase2GraphResult = {
  finalResponse?: string;
  documents?: PDFDocument[];
  uiAction?: UIActionUpdate;
  pendingCheckInRequest?: SubjectiveCheckInRequest | null;
};

export type ChatMessageCheckInStatus = "pending" | "submitted" | "skipped";

export type ChatMessageModel = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: PDFDocument[];
  uiAction?: UIActionUpdate;
  checkInStatus?: ChatMessageCheckInStatus;
};