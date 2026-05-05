"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  HeartPulse,
  Loader2,
  MessageCircleHeart,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { ExamplePrompts } from "@/components/example-prompts";
import { ChatMessage } from "@/components/chat-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { client } from "@/lib/langgraph-client";
import {
  buildSkipAllCheckInResponse,
  buildSubjectiveCheckInResponse,
  type SubjectiveCheckInAnswers,
} from "@/lib/subjective-checkin";
import type {
  ChatMessageModel,
  ChatRequestPayload,
  PDFDocument,
  SubjectiveCheckInRequest,
  UIActionUpdate,
} from "@/types/graphTypes";

type ChatSSEEvent = {
  event: string;
  data: unknown;
};

type UpdatesPayload = {
  threadId?: string;
  uiAction?: UIActionUpdate;
  retrieveDocuments?: {
    documents?: PDFDocument[];
  };
};

type MessagePartialPayload = Array<{
  type?: string;
  content?: string;
}>;

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSSEChunk(buffer: string): {
  completeEvents: string[];
  remainingBuffer: string;
} {
  const parts = buffer.split("\n\n");
  return {
    completeEvents: parts.slice(0, -1),
    remainingBuffer: parts[parts.length - 1] ?? "",
  };
}

function parseSSEEvent(rawEvent: string): ChatSSEEvent | null {
  const dataLine = rawEvent
    .split("\n")
    .find((line) => line.startsWith("data: "));

  if (!dataLine) return null;

  try {
    return JSON.parse(dataLine.slice("data: ".length)) as ChatSSEEvent;
  } catch (error) {
    console.error("Failed to parse SSE event:", error);
    return null;
  }
}

function isUpdatesPayload(data: unknown): data is UpdatesPayload {
  return typeof data === "object" && data !== null;
}

function isMessagePartialPayload(data: unknown): data is MessagePartialPayload {
  return Array.isArray(data);
}

export default function Home() {
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessageModel[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pendingCheckInRequest, setPendingCheckInRequest] =
    useState<SubjectiveCheckInRequest | null>(null);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastRetrievedDocsRef = useRef<PDFDocument[]>([]);

  useEffect(() => {
    const initThread = async () => {
      if (threadId) return;

      try {
        const thread = await client.createThread();
        setThreadId(thread.thread_id);
      } catch (error) {
        console.error("Error creating thread:", error);
        toast({
          title: "Error",
          description:
            "Error creating thread. The chat can still try to create one through the API.",
          variant: "destructive",
        });
      }
    };

    initThread();
  }, [threadId, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function updateAssistantMessage(
    assistantMessageId: string,
    update: Partial<ChatMessageModel>,
  ) {
    setMessages((current) =>
      current.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              ...update,
            }
          : message,
      ),
    );
  }

  function markCheckInStatus(
    requestId: string,
    status: "submitted" | "skipped",
  ) {
    setMessages((current) =>
      current.map((message) => {
        if (
          message.uiAction?.type === "subjective_checkin" &&
          message.uiAction.request.requestId === requestId
        ) {
          return {
            ...message,
            checkInStatus: status,
          };
        }

        return message;
      }),
    );
  }

  async function sendChatRequest(
    payload: ChatRequestPayload,
    assistantMessageId: string,
  ) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    lastRetrievedDocsRef.current = [];

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let isReading = true;

    while (isReading) {
      const { done, value } = await reader.read();

      if (done) {
        isReading = false;
        continue;
      }

      buffer += decoder.decode(value, { stream: true });

      const { completeEvents, remainingBuffer } = parseSSEChunk(buffer);
      buffer = remainingBuffer;

      for (const rawEvent of completeEvents) {
        const parsedEvent = parseSSEEvent(rawEvent);
        if (!parsedEvent) continue;

        if (
          parsedEvent.event === "updates" &&
          isUpdatesPayload(parsedEvent.data)
        ) {
          const updates = parsedEvent.data;

          if (typeof updates.threadId === "string") {
            setThreadId(updates.threadId);
          }

          if (updates.uiAction) {
            updateAssistantMessage(assistantMessageId, {
              uiAction: updates.uiAction,
            });

            if (updates.uiAction.type === "subjective_checkin") {
              setPendingCheckInRequest(updates.uiAction.request);
            }
          }

          if (updates.retrieveDocuments?.documents) {
            lastRetrievedDocsRef.current =
              updates.retrieveDocuments.documents;
          }
        }

        if (
          parsedEvent.event === "messages/partial" &&
          isMessagePartialPayload(parsedEvent.data)
        ) {
          const content = parsedEvent.data
            .map((message) => message.content ?? "")
            .join("");

          updateAssistantMessage(assistantMessageId, {
            content,
            sources: lastRetrievedDocsRef.current,
          });
        }
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const userMessageId = createMessageId("user");
    const assistantMessageId = createMessageId("assistant");

    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content: userMessage,
        sources: undefined,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        sources: undefined,
      },
    ]);

    setInput("");
    setIsLoading(true);
    setPendingCheckInRequest(null);

    try {
      await sendChatRequest(
        {
          message: userMessage,
          threadId: threadId ?? undefined,
          checkInResponse: null,
          clientMeta: {
            source: "chat_input",
          },
        },
        assistantMessageId,
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") return;

      console.error("Error sending message:", error);

      updateAssistantMessage(assistantMessageId, {
        content:
          "I’m sorry, something went wrong while responding. Please try again.",
      });

      toast({
        title: "Error",
        description: "Error sending message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmitCheckIn(
    request: SubjectiveCheckInRequest,
    answers: SubjectiveCheckInAnswers,
  ) {
    if (isLoading || isSubmittingCheckIn) return;

    const userMessageId = createMessageId("user-checkin");
    const assistantMessageId = createMessageId("assistant-checkin");

    markCheckInStatus(request.requestId, "submitted");

    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content: "I answered the quick check-in.",
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        sources: undefined,
      },
    ]);

    setIsLoading(true);
    setIsSubmittingCheckIn(true);
    setPendingCheckInRequest(null);

    try {
      await sendChatRequest(
        {
          message: "",
          threadId: threadId ?? undefined,
          checkInResponse: buildSubjectiveCheckInResponse({
            request,
            answers,
          }),
          clientMeta: {
            source: "micro_checkin",
          },
        },
        assistantMessageId,
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") return;

      console.error("Error submitting check-in:", error);

      updateAssistantMessage(assistantMessageId, {
        content:
          "I’m sorry, something went wrong after the check-in. Please try again.",
      });

      toast({
        title: "Error",
        description: "Error submitting check-in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsSubmittingCheckIn(false);
    }
  }

  async function handleSkipCheckIn(request: SubjectiveCheckInRequest) {
    if (isLoading || isSubmittingCheckIn) return;

    const userMessageId = createMessageId("user-skip");
    const assistantMessageId = createMessageId("assistant-skip");

    markCheckInStatus(request.requestId, "skipped");

    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content: "I skipped the quick check-in.",
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        sources: undefined,
      },
    ]);

    setIsLoading(true);
    setIsSubmittingCheckIn(true);
    setPendingCheckInRequest(null);

    try {
      await sendChatRequest(
        {
          message: "",
          threadId: threadId ?? undefined,
          checkInResponse: buildSkipAllCheckInResponse(request),
          clientMeta: {
            source: "skip_action",
          },
        },
        assistantMessageId,
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") return;

      console.error("Error skipping check-in:", error);

      updateAssistantMessage(assistantMessageId, {
        content:
          "I’m sorry, something went wrong while continuing. Please try again.",
      });

      toast({
        title: "Error",
        description: "Error continuing after skip. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsSubmittingCheckIn(false);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <main className="flex min-h-screen flex-col items-center bg-background">
      <div className="w-full max-w-5xl flex-1 px-4 py-8">
        {!hasMessages ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
            <div className="space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <MessageCircleHeart className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Recovery Support Assistant
              </h1>
              <p className="max-w-2xl text-muted-foreground">
                A safety-aware alcohol-support chat experience for cravings,
                lapses, grounding, and safe next steps.
              </p>
            </div>

            <div className="grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="rounded-2xl">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-5 w-5" />
                    <h2 className="font-medium">Support, not diagnosis</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This assistant can offer supportive coping steps and
                    grounding, but it is not a clinician or emergency service.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    <h2 className="font-medium">Safety-bounded</h2>
                  </div>
                  <ul className="space-y-2 text-left text-sm text-muted-foreground">
                    <li>No diagnosis or clinical assessment</li>
                    <li>No medication, dosage, detox, or withdrawal guidance</li>
                    <li>No unsafe alcohol-use or alcohol-hiding guidance</li>
                    <li>No harmful or self-harm-enabling guidance</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <TriangleAlert className="h-5 w-5" />
                    <h2 className="font-medium">Escalation when needed</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    If something sounds medically urgent or immediately unsafe,
                    the assistant uses generic safety language and encourages
                    real-world help.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <h2 className="font-medium">
                      Curated alcohol-support knowledge
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Safe support responses can draw from approved internal
                    alcohol-support notes. High-risk and refusal paths use fixed
                    templates instead.
                  </p>
                </CardContent>
              </Card>
            </div>

            <ExamplePrompts onPromptSelect={setInput} />
          </div>
        ) : (
          <div className="w-full space-y-4 pb-40">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onSubmitCheckIn={handleSubmitCheckIn}
                onSkipCheckIn={handleSkipCheckIn}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-5xl space-y-3">
          <p className="text-xs text-muted-foreground">
            Responses are grounded in a curated alcohol-support knowledge base
            and safety rules. This assistant cannot provide diagnosis,
            medication advice, detox instructions, or emergency support.
          </p>

          {pendingCheckInRequest && (
            <p className="text-xs text-muted-foreground">
              A quick optional check-in is available above. You can answer it or
              skip it.
            </p>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <div className="flex gap-2 overflow-hidden rounded-2xl border bg-gray-50">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about alcohol cravings, lapses, recovery support, grounding, or safe next steps..."
                className="h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-12 rounded-none"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}