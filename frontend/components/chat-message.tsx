"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import type {
  ChatMessageModel,
  PDFDocument,
  SubjectiveCheckInRequest,
} from "@/types/graphTypes";
import type { SubjectiveCheckInAnswers } from "@/lib/subjective-checkin";
import { SubjectiveCheckInCard } from "@/components/subjective-checkin-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ChatMessageProps {
  message: ChatMessageModel;
  onSubmitCheckIn?: (
    request: SubjectiveCheckInRequest,
    answers: SubjectiveCheckInAnswers,
  ) => void | Promise<void>;
  onSkipCheckIn?: (
    request: SubjectiveCheckInRequest,
  ) => void | Promise<void>;
}

function getSourceTitle(source: PDFDocument): string {
  const metadata = source.metadata ?? {};

  return String(
    metadata.title ||
      metadata.source ||
      metadata.filename ||
      "Internal support note",
  );
}

function getSourceSubtitle(source: PDFDocument): string {
  const metadata = source.metadata ?? {};

  const parts = [
    metadata.kbType ? String(metadata.kbType) : null,
    metadata.riskCategory ? String(metadata.riskCategory) : null,
    metadata.version ? String(metadata.version) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Approved support source";
}

export function ChatMessage({
  message,
  onSubmitCheckIn,
  onSkipCheckIn,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const isLoading = message.role === "assistant" && message.content === "";

  const showSources =
    message.role === "assistant" &&
    message.sources &&
    message.sources.length > 0;

  const showCheckIn =
    message.role === "assistant" &&
    message.uiAction?.type === "subjective_checkin";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser ? "bg-black text-white" : "bg-muted"
        }`}
      >
        {isLoading ? (
          <div className="flex space-x-1 h-6 items-center">
            <div className="w-1.5 h-1.5 bg-current rounded-full animate-[loading_1s_ease-in-out_infinite]" />
            <div className="w-1.5 h-1.5 bg-current rounded-full animate-[loading_1s_ease-in-out_0.2s_infinite]" />
            <div className="w-1.5 h-1.5 bg-current rounded-full animate-[loading_1s_ease-in-out_0.4s_infinite]" />
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{message.content}</p>

            {showCheckIn && message.uiAction?.type === "subjective_checkin" && (
              <SubjectiveCheckInCard
                request={message.uiAction.request}
                status={message.checkInStatus ?? "pending"}
                disabled={message.checkInStatus !== undefined}
                onSubmit={(answers) =>
                  onSubmitCheckIn?.(message.uiAction!.request, answers)
                }
                onSkip={() => onSkipCheckIn?.(message.uiAction!.request)}
              />
            )}

            {!isUser && (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                  title={copied ? "Copied!" : "Copy to clipboard"}
                >
                  <Copy
                    className={`h-4 w-4 ${copied ? "text-green-500" : ""}`}
                  />
                </Button>
              </div>
            )}

            {showSources && message.sources && (
              <Accordion type="single" collapsible className="w-full mt-2">
                <AccordionItem value="sources" className="border-b-0">
                  <AccordionTrigger className="text-sm py-2 justify-start gap-2 hover:no-underline">
                    View support sources ({message.sources.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {message.sources.map((source, index) => (
                        <Card
                          key={index}
                          className="bg-background/50 transition-all duration-200 hover:bg-background hover:shadow-md hover:scale-[1.02]"
                        >
                          <CardContent className="p-3">
                            <p className="text-sm font-medium truncate">
                              {getSourceTitle(source)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {getSourceSubtitle(source)}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </>
        )}
      </div>
    </div>
  );
}