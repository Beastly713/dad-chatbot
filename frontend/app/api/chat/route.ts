import { Client } from "@langchain/langgraph-sdk";
import { NextRequest } from "next/server";
import type {
  ChatRequestPayload,
  SubjectiveUIAction,
} from "@/types/graphTypes";

export const runtime = "edge";

type StreamEventPayload = {
  event: string;
  data: unknown;
};

function createSSEEncoder() {
  const encoder = new TextEncoder();

  return (payload: StreamEventPayload) =>
    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function normalizeMessage(message: unknown): string {
  if (typeof message !== "string") return "";
  return message;
}

function isNonEmptyMessage(message: string): boolean {
  return message.trim().length > 0;
}

function hasCheckInResponse(payload: ChatRequestPayload): boolean {
  return !!payload.checkInResponse;
}

function isValidChatPayload(payload: ChatRequestPayload): boolean {
  const message = normalizeMessage(payload.message);

  return isNonEmptyMessage(message) || hasCheckInResponse(payload);
}

function extractUiActionFromGraphResult(result: unknown): SubjectiveUIAction {
  if (!result || typeof result !== "object") return null;

  const maybeResult = result as {
    uiAction?: SubjectiveUIAction;
  };

  return maybeResult.uiAction ?? null;
}

function extractDocumentsFromGraphResult(result: unknown): unknown[] {
  if (!result || typeof result !== "object") return [];

  const maybeResult = result as {
    documents?: unknown[];
  };

  return Array.isArray(maybeResult.documents) ? maybeResult.documents : [];
}

function extractFinalResponseFromGraphResult(result: unknown): string {
  if (!result || typeof result !== "object") return "";

  const maybeResult = result as {
    finalResponse?: unknown;
    messages?: Array<{ content?: unknown }>;
  };

  if (typeof maybeResult.finalResponse === "string") {
    return maybeResult.finalResponse;
  }

  const messages = Array.isArray(maybeResult.messages)
    ? maybeResult.messages
    : [];

  const finalMessage = messages[messages.length - 1];

  if (typeof finalMessage?.content === "string") {
    return finalMessage.content;
  }

  return "";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestPayload;

    if (!isValidChatPayload(body)) {
      return new Response(
        JSON.stringify({
          error: "Either message or checkInResponse is required.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const message = normalizeMessage(body.message);
    const threadId = body.threadId;

    const client = new Client({
      apiUrl:
        process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "http://localhost:2024",
    });

    const assistantId =
      process.env.LANGGRAPH_RETRIEVAL_ASSISTANT_ID ?? "retrieval_graph";

    const thread = threadId
      ? { thread_id: threadId }
      : await client.threads.create();

    const activeThreadId = thread.thread_id;

    const result = await client.runs.wait(activeThreadId, assistantId, {
      input: {
        query: message,
        checkInResponse: body.checkInResponse ?? null,
        clientMeta: body.clientMeta ?? {
          source: body.checkInResponse ? "micro_checkin" : "chat_input",
        },
      },
    });

    const encode = createSSEEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const uiAction = extractUiActionFromGraphResult(result);
        const documents = extractDocumentsFromGraphResult(result);
        const finalResponse = extractFinalResponseFromGraphResult(result);

        controller.enqueue(
          encode({
            event: "updates",
            data: {
              threadId: activeThreadId,
            },
          }),
        );

        if (uiAction) {
          controller.enqueue(
            encode({
              event: "updates",
              data: {
                uiAction,
              },
            }),
          );
        }

        if (documents.length > 0) {
          controller.enqueue(
            encode({
              event: "updates",
              data: {
                retrieveDocuments: {
                  documents,
                },
              },
            }),
          );
        }

        /**
         * Keep the existing frontend-compatible event shape.
         *
         * Phase 1/2 should still emit only one final guarded assistant answer
         * here, not token-level partial LLM streaming.
         */
        controller.enqueue(
          encode({
            event: "messages/partial",
            data: [
              {
                type: "ai",
                content: finalResponse,
              },
            ],
          }),
        );

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to process chat request.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}