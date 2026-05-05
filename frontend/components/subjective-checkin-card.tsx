"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubjectiveCheckInOption } from "@/components/subjective-checkin-option";
import type {
  SubjectiveCheckInAnswerValue,
  SubjectiveCheckInField,
  SubjectiveCheckInRequest,
} from "@/types/graphTypes";
import type { SubjectiveCheckInAnswers } from "@/lib/subjective-checkin";

interface SubjectiveCheckInCardProps {
  request: SubjectiveCheckInRequest;
  disabled?: boolean;
  status?: "pending" | "submitted" | "skipped";
  onSubmit: (answers: SubjectiveCheckInAnswers) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}

export function SubjectiveCheckInCard({
  request,
  disabled = false,
  status = "pending",
  onSubmit,
  onSkip,
}: SubjectiveCheckInCardProps) {
  const [answers, setAnswers] = useState<SubjectiveCheckInAnswers>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requiredFields = useMemo(
    () =>
      request.questions
        .filter((question) => question.required)
        .map((question) => question.field),
    [request.questions],
  );

  const hasRequiredAnswers = requiredFields.every(
    (field) => answers[field] !== undefined && answers[field] !== null,
  );

  const hasAnyAnswer = Object.keys(answers).length > 0;

  const isLocked = disabled || status !== "pending" || isSubmitting;
  const canSubmit = !isLocked && hasRequiredAnswers && hasAnyAnswer;

  function setAnswer(
    field: SubjectiveCheckInField,
    value: SubjectiveCheckInAnswerValue,
  ) {
    setAnswers((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit(answers);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSkip() {
    if (isLocked) return;

    setIsSubmitting(true);
    try {
      await onSkip();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mt-3 rounded-2xl border bg-background/80">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Quick optional check-in</p>
          <p className="text-xs text-muted-foreground">
            This only helps tailor support for this moment. You can skip it.
          </p>
        </div>

        <div className="space-y-4">
          {request.questions.map((question) => (
            <div key={question.field} className="space-y-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">{question.prompt}</p>
                {question.helperText && (
                  <p className="text-xs text-muted-foreground">
                    {question.helperText}
                  </p>
                )}
              </div>

              {question.inputType === "chips" && question.options && (
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option) => (
                    <SubjectiveCheckInOption
                      key={option.value}
                      label={option.label}
                      selected={answers[question.field] === option.value}
                      disabled={isLocked}
                      onClick={() => setAnswer(question.field, option.value)}
                    />
                  ))}
                </div>
              )}

              {question.inputType === "text" && (
                <Input
                  disabled={isLocked}
                  value={String(answers[question.field] ?? "")}
                  onChange={(event) =>
                    setAnswer(question.field, event.target.value)
                  }
                  placeholder="Optional"
                  className="text-sm"
                />
              )}
            </div>
          ))}
        </div>

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Check-in submitted.
          </div>
        )}

        {status === "skipped" && (
          <div className="text-xs text-muted-foreground">
            Check-in skipped.
          </div>
        )}

        {status === "pending" && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Sending
                </>
              ) : (
                "Submit check-in"
              )}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleSkip}
              disabled={isLocked}
              className="rounded-full"
            >
              Skip
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}