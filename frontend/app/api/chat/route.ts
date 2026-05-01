import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/langgraph-server';
import { retrievalAssistantStreamConfig } from '@/constants/graphConfigs';

export const runtime = 'edge';

type LangGraphMessage = {
  type?: string;
  content?: unknown;
  kwargs?: {
    content?: unknown;
  };
};

type Phase1GraphResult = {
  finalResponse?: unknown;
  messages?: LangGraphMessage[];
  documents?: unknown;
  guard?: {
    finalText?: unknown;
  };
};

function stringifyContent(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (
          item &&
          typeof item === 'object' &&
          'text' in item &&
          typeof item.text === 'string'
        ) {
          return item.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('');
  }

  return null;
}

function extractFinalText(result: Phase1GraphResult): string {
  const directFinal = stringifyContent(result.finalResponse);

  if (directFinal) {
    return directFinal;
  }

  const guardFinal = stringifyContent(result.guard?.finalText);

  if (guardFinal) {
    return guardFinal;
  }

  const messages = Array.isArray(result.messages) ? result.messages : [];
  const lastAiMessage = [...messages]
    .reverse()
    .find((message) => message.type === 'ai' || message.type === 'assistant');

  const messageContent =
    stringifyContent(lastAiMessage?.content) ??
    stringifyContent(lastAiMessage?.kwargs?.content);

  if (messageContent) {
    return messageContent;
  }

  return "I'm sorry, but I can't safely help with that. If there may be immediate danger, please contact local emergency services or a trusted person nearby.";
}

function sseEncode(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(req: Request) {
  try {
    const { message, threadId } = await req.json();

    if (!message || typeof message !== 'string' || !message.trim()) {
      return new NextResponse(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.LANGGRAPH_RETRIEVAL_ASSISTANT_ID) {
      return new NextResponse(
        JSON.stringify({
          error: 'LANGGRAPH_RETRIEVAL_ASSISTANT_ID is not set',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const assistantId = process.env.LANGGRAPH_RETRIEVAL_ASSISTANT_ID;
    const serverClient = createServerClient();

    /**
     * Phase 1 meaning of threadId:
     * - conversation state only
     * - not document scope
     *
     * If the client does not provide one, create a conversation thread here.
     */
    const activeThreadId =
      typeof threadId === 'string' && threadId.trim()
        ? threadId
        : (await serverClient.createThread()).thread_id;

    /**
     * Do not stream partial LLM tokens to the user.
     *
     * Wait for the graph to finish so the backend graph can:
     * - generate a complete draft if RAG is allowed
     * - run finalGuard
     * - return only the guarded final response
     */
    const result = (await serverClient.client.runs.wait(
      activeThreadId,
      assistantId,
      {
        input: { query: message },
        config: {
          configurable: {
            ...retrievalAssistantStreamConfig,
            filterKwargs: {
              ...(retrievalAssistantStreamConfig.filterKwargs || {}),
            },
          },
        },
      },
    )) as Phase1GraphResult;

    const finalText = extractFinalText(result);

    const customReadable = new ReadableStream({
      start(controller) {
        /**
         * Preserve the frontend's existing source display behavior, but only
         * emit this after the guarded run has completed.
         */
        if (Array.isArray(result.documents) && result.documents.length > 0) {
          controller.enqueue(
            sseEncode({
              event: 'updates',
              data: {
                retrieveDocuments: {
                  documents: result.documents,
                },
              },
            }),
          );
        }

        /**
         * Preserve the frontend's existing SSE parsing shape while sending only
         * one guarded final assistant message.
         */
        controller.enqueue(
          sseEncode({
            event: 'messages/partial',
            data: [
              {
                type: 'ai',
                content: finalText,
              },
            ],
          }),
        );

        controller.close();
      },
    });

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Route error:', error);

    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}