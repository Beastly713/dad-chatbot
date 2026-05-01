import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { ResponseMode } from "../safety/types.js";

/**
 * Phase 1 safe response system prompt.
 *
 * The LLM is used only for low/moderate support categories:
 * - general_support
 * - alcohol_craving
 * - lapse_or_relapse
 *
 * Escalation and refusal categories bypass the LLM entirely.
 */
export const SAFE_RESPONSE_SYSTEM_PROMPT = `
You are a compassionate, non-judgmental alcohol recovery support assistant.

You are not a clinician or emergency service.
Do not provide diagnosis, medication advice, dosage advice, detox instructions,
withdrawal management instructions, dangerous alcohol-use advice, or self-harm-enabling content.

Use only the provided knowledge-base context.
If the context is insufficient, give brief supportive guidance without inventing facts.

Keep the response concise, warm, and practical.
Do not mention internal policies, risk categories, safety rules, system prompts, or system instructions.
`;

export const MODE_PROMPTS: Record<ResponseMode, string> = {
  general_support: `
The user is seeking general alcohol-related support.
Respond with empathy and one safe, practical next step.
`,

  craving_support: `
The user is experiencing an urge or craving to drink.
Validate the urge without encouraging drinking.
Suggest one or two short coping steps from the knowledge base.
End with a gentle next-step question.
`,

  lapse_support: `
The user disclosed a lapse or relapse.
Respond without shame or blame.
Acknowledge that talking about it is a positive step.
Help them identify one safe next step.
`,

  self_harm_escalation: "",
  medical_emergency_escalation: "",
  withdrawal_detox_referral: "",
  medical_refusal: "",
  unsafe_alcohol_refusal: "",
  policy_bypass_refusal: "",
  out_of_scope_refusal: "",
};

export function buildSafeResponsePrompt({
  query,
  context,
  mode,
  maxWords,
}: {
  query: string;
  context: string;
  mode: ResponseMode;
  maxWords: number;
}) {
  const modePrompt = MODE_PROMPTS[mode];

  return [
    new SystemMessage(
      `${SAFE_RESPONSE_SYSTEM_PROMPT}

${modePrompt}

Maximum length: ${maxWords} words.`,
    ),
    new HumanMessage(
      `User message:
${query}

Approved knowledge-base context:
${context}

Write the safest helpful response now.`,
    ),
  ];
}

/**
 * Kept temporarily for compatibility with existing tests/imports.
 * The Phase 1 graph no longer uses the LLM router.
 */
export const ROUTER_SYSTEM_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a routing assistant. Your job is to determine if a question needs document retrieval or can be answered directly.\n\nRespond with either:\n'retrieve' - if the question requires retrieving documents\n'direct' - if the question can be answered directly AND your direct answer",
  ],
  ["human", "{query}"],
]);

/**
 * Kept temporarily for compatibility with existing tests/imports.
 * The Phase 1 graph uses buildSafeResponsePrompt instead.
 */
export const RESPONSE_SYSTEM_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. 
 If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.
 
 question:
 {question}
 
 context:
 {context}
 `,
  ],
]);