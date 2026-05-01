import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/langgraph-server';
import { retrievalAssistantStreamConfig } from '@/constants/graphConfigs';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { message, threadId } = await req.json();

    if (!message) {
      return new NextResponse(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!threadId) {
      return new NextResponse(
        JSON.stringify({ error: 'Thread ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (!process.env.LANGGRAPH_RETRIEVAL_ASSISTANT_ID) {
      return new NextResponse(
        JSON.stringify({
          error: 'LANGGRAPH_RETRIEVAL_ASSISTANT_ID is not set',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    try {
      const assistantId = process.env.LANGGRAPH_RETRIEVAL_ASSISTANT_ID;
      const serverClient = createServerClient();

      const stream = await serverClient.client.runs.stream(
        threadId,
        assistantId,
        {
          input: { query: message },
          streamMode: ['messages', 'updates'],
          config: {
            configurable: {
              ...retrievalAssistantStreamConfig,
              filterKwargs: {
                ...(retrievalAssistantStreamConfig.filterKwargs || {}),
                threadId,
              },
            },
          },
        },
      );

      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
              );
            }
          } catch (error) {
            console.error('Streaming error:', error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: 'Streaming error occurred' })}\n\n`,
              ),
            );
          } finally {
            controller.close();
          }
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
      console.error('Stream initialization error:', error);
      return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Route error:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}