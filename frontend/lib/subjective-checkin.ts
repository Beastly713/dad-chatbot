import type {
  SubjectiveCheckInAnswerValue,
  SubjectiveCheckInField,
  SubjectiveCheckInRequest,
  SubjectiveCheckInResponse,
} from "@/types/graphTypes";

export type SubjectiveCheckInAnswers = Partial<
  Record<SubjectiveCheckInField, SubjectiveCheckInAnswerValue>
>;

export function buildSubjectiveCheckInResponse(params: {
  request: SubjectiveCheckInRequest;
  answers: SubjectiveCheckInAnswers;
  skippedFields?: SubjectiveCheckInField[] | ["all"];
  submittedAt?: Date;
}): SubjectiveCheckInResponse {
  return {
    requestId: params.request.requestId,
    answers: params.answers,
    skippedFields: params.skippedFields ?? [],
    submittedAt: (params.submittedAt ?? new Date()).toISOString(),
  };
}

export function buildSkipAllCheckInResponse(
  request: SubjectiveCheckInRequest,
  submittedAt: Date = new Date(),
): SubjectiveCheckInResponse {
  return {
    requestId: request.requestId,
    answers: {},
    skippedFields: ["all"],
    submittedAt: submittedAt.toISOString(),
  };
}