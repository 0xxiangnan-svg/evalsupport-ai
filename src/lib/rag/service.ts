import type { ChatCompletionResult } from "@/lib/ai/openai-compatible";
import type { SourceChunk } from "@/lib/rag/citations";
import { getValidCitations } from "@/lib/rag/citations";
import {
  buildFallbackAnswer,
  type FallbackReason,
  getRetrievalFallbackReason,
} from "@/lib/rag/confidence";
import { buildRagMessages } from "@/lib/rag/prompt";

export type ConversationStatus =
  | "answered"
  | "ticket_created"
  | "answer_anomaly"
  | "error";

export type RagTicket = {
  id: string;
  triggerReason: FallbackReason;
};

export type RagServiceResponse = {
  status: "answered" | "ticket_created";
  answer: string;
  citations: SourceChunk[];
  ticket: RagTicket | null;
  conversationId: string;
  metrics: {
    latencyMs: number;
    topSimilarity: number | null;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    model: string | null;
  };
};

export type RagServiceDeps = {
  embedQuestion: (question: string) => Promise<number[]>;
  matchChunks: (embedding: number[]) => Promise<SourceChunk[]>;
  complete: (question: string, sources: SourceChunk[]) => Promise<ChatCompletionResult>;
  saveConversation: (input: {
    question: string;
    answer: string;
    status: ConversationStatus;
    topSimilarity: number | null;
    latencyMs: number;
    usage: ChatCompletionResult["usage"] | null;
    model: string | null;
  }) => Promise<string>;
  saveCitations: (conversationId: string, citations: SourceChunk[]) => Promise<void>;
  createTicket: (input: {
    conversationId: string;
    question: string;
    triggerReason: FallbackReason;
    aiAssessment: string;
  }) => Promise<string>;
};

export type RagServiceOptions = {
  minSimilarity: number;
};

export async function answerQuestionWithRag(
  question: string,
  deps: RagServiceDeps,
  options: RagServiceOptions,
): Promise<RagServiceResponse> {
  const startedAt = Date.now();
  const questionEmbedding = await deps.embedQuestion(question);
  const sources = await deps.matchChunks(questionEmbedding);
  const topSimilarity = sources[0]?.similarity ?? null;
  const retrievalFallback = getRetrievalFallbackReason({
    topSimilarity,
    sourceCount: sources.length,
    minSimilarity: options.minSimilarity,
  });

  if (retrievalFallback) {
    return createFallbackResponse({
      question,
      reason: retrievalFallback,
      answer: buildFallbackAnswer(retrievalFallback),
      deps,
      startedAt,
      topSimilarity,
      model: null,
      usage: null,
      conversationStatus: "ticket_created",
    });
  }

  const completion = await deps.complete(question, sources);
  const validCitations = getValidCitations(completion.text, sources);

  if (!validCitations.length) {
    const reason = "missing_model_citation" satisfies FallbackReason;
    return createFallbackResponse({
      question,
      reason,
      answer: buildFallbackAnswer(reason),
      deps,
      startedAt,
      topSimilarity,
      model: completion.model,
      usage: completion.usage,
      conversationStatus: "answer_anomaly",
    });
  }

  const latencyMs = Date.now() - startedAt;
  const conversationId = await deps.saveConversation({
    question,
    answer: completion.text,
    status: "answered",
    topSimilarity,
    latencyMs,
    usage: completion.usage,
    model: completion.model,
  });
  await deps.saveCitations(conversationId, validCitations);

  return {
    status: "answered",
    answer: completion.text,
    citations: validCitations,
    ticket: null,
    conversationId,
    metrics: {
      latencyMs,
      topSimilarity,
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
      totalTokens: completion.usage.totalTokens,
      model: completion.model,
    },
  };
}

export async function completeRagAnswer(
  question: string,
  sources: SourceChunk[],
  complete: (messages: ReturnType<typeof buildRagMessages>) => Promise<ChatCompletionResult>,
) {
  return complete(buildRagMessages(question, sources));
}

async function createFallbackResponse(input: {
  question: string;
  reason: FallbackReason;
  answer: string;
  deps: RagServiceDeps;
  startedAt: number;
  topSimilarity: number | null;
  model: string | null;
  usage: ChatCompletionResult["usage"] | null;
  conversationStatus: ConversationStatus;
}) {
  const latencyMs = Date.now() - input.startedAt;
  const conversationId = await input.deps.saveConversation({
    question: input.question,
    answer: input.answer,
    status: input.conversationStatus,
    topSimilarity: input.topSimilarity,
    latencyMs,
    usage: input.usage,
    model: input.model,
  });
  const ticketId = await input.deps.createTicket({
    conversationId,
    question: input.question,
    triggerReason: input.reason,
    aiAssessment: input.answer,
  });

  return {
    status: "ticket_created",
    answer: input.answer,
    citations: [],
    ticket: {
      id: ticketId,
      triggerReason: input.reason,
    },
    conversationId,
    metrics: {
      latencyMs,
      topSimilarity: input.topSimilarity,
      promptTokens: input.usage?.promptTokens ?? null,
      completionTokens: input.usage?.completionTokens ?? null,
      totalTokens: input.usage?.totalTokens ?? null,
      model: input.model,
    },
  } satisfies RagServiceResponse;
}
