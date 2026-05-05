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

  const checkInRequest =
    message.role === "assistant" &&
    message.uiAction?.type === "subjective_checkin"
      ? message.uiAction.request
      : null;

  const showCheckIn = !!checkInRequest;

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
          <div className="flex h-6 items-center space-x-1">
            <div className="h-1.5 w-1.5 animate-[loading_1s_ease-in-out_infinite] rounded-full bg-current" />
            <div className="h-1.5 w-1.5 animate-[loading_1s_ease-in-out_0.2s_infinite] rounded-full bg-current" />
            <div className="h-1.5 w-1.5 animate-[loading_1s_ease-in-out_0.4s_infinite] rounded-full bg-current" />
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{message.content}</p>

            {showCheckIn && checkInRequest && (
              <SubjectiveCheckInCard
                request={checkInRequest}
                status={message.checkInStatus ?? "pending"}
                disabled={message.checkInStatus !== undefined}
                onSubmit={(answers) => onSubmitCheckIn?.(checkInRequest, answers)}
                onSkip={() => onSkipCheckIn?.(checkInRequest)}
              />
            )}

            {!isUser && (
              <div className="mt-2 flex gap-2">
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
              <Accordion type="single" collapsible className="mt-2 w-full">
                <AccordionItem value="sources" className="border-b-0">
                  <AccordionTrigger className="justify-start gap-2 py-2 text-sm hover:no-underline">
                    View support sources ({message.sources.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {message.sources.map((source, index) => (
                        <Card
                          key={index}
                          className="bg-background/50 transition-all duration-200 hover:scale-[1.02] hover:bg-background hover:shadow-md"
                        >
                          <CardContent className="p-3">
                            <p className="truncate text-sm font-medium">
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