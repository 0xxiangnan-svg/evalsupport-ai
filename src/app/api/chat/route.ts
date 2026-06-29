import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createChatCompletion,
  createChatCompletionWithProviderConfig,
  createEmbedding,
  createLocalEmbedding,
} from "@/lib/ai/openai-compatible";
import {
  parseProviderConfig,
  providerConfigSchema,
  redactSensitiveText,
} from "@/lib/ai/provider-config";
import { createLocalGroundedCompletion } from "@/lib/ai/local-answer";
import { getConfig, hasSupabaseConfig, shouldUseLocalDemo } from "@/lib/config";
import { productionPersistenceUnavailable } from "@/lib/api/production-guard";
import {
  attachCustomerSessionCookie,
  getOrCreateCustomerSession,
} from "@/lib/customer-session";
import { toPgVector } from "@/lib/db/vector";
import { localDemoStore, scoreTextSimilarity } from "@/lib/local-demo/store";
import type { DemoSessionChunk } from "@/lib/local-demo/types";
import type { SourceChunk } from "@/lib/rag/citations";
import { buildRagMessages } from "@/lib/rag/prompt";
import {
  answerQuestionWithRag,
  type ConversationStatus,
} from "@/lib/rag/service";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatRequestSchema = z.object({
  question: z.string().min(1).max(2000),
  providerConfig: providerConfigSchema.optional(),
  demoChunks: z
    .array(
      z.object({
        chunkId: z.string().min(1).max(120),
        documentId: z.string().min(1).max(120),
        documentName: z.string().min(1).max(240),
        content: z.string().min(1).max(5000),
        pageNumber: z.number().int().nullable(),
        position: z.number().int().nonnegative(),
      }),
    )
    .max(120)
    .optional(),
});

function matchDemoSessionChunks(
  question: string,
  chunks: DemoSessionChunk[],
  matchCount: number,
  minSimilarity: number,
) {
  return chunks
    .map((chunk) => ({
      chunk,
      similarity: scoreTextSimilarity(question, chunk.content),
    }))
    .filter((item) => item.similarity >= minSimilarity)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, matchCount)
    .map(
      (item, index) =>
        ({
          label: `S${index + 1}`,
          chunkId: item.chunk.chunkId,
          documentId: item.chunk.documentId,
          documentName: item.chunk.documentName,
          content: item.chunk.content,
          similarity: item.similarity,
          pageNumber: item.chunk.pageNumber,
          position: item.chunk.position,
        }) satisfies SourceChunk,
    );
}

export async function POST(request: Request) {
  let apiKeyForRedaction: string | undefined;

  try {
    const { question, demoChunks, providerConfig: rawProviderConfig } =
      chatRequestSchema.parse(await request.json());
    const providerConfig = rawProviderConfig
      ? parseProviderConfig(rawProviderConfig)
      : null;
    apiKeyForRedaction = providerConfig?.apiKey;
    const config = getConfig();
    const supabaseConfigured = hasSupabaseConfig();
    const browserDemoAvailable = !supabaseConfigured && Boolean(demoChunks?.length);

    if (shouldUseLocalDemo() || browserDemoAvailable) {
      const localMinSimilarity = 0.25;
      const response = await answerQuestionWithRag(
        question,
        {
          embedQuestion: async (value) => createLocalEmbedding(value),
          matchChunks: async () =>
            demoChunks?.length
              ? matchDemoSessionChunks(
                  question,
                  demoChunks,
                  config.RAG_TOP_K,
                  localMinSimilarity,
                )
              : localDemoStore
                  .matchChunksByText(question, config.RAG_TOP_K, localMinSimilarity)
                  .map((row, index) => ({
                    label: `S${index + 1}`,
                    chunkId: row.chunk_id,
                    documentId: row.document_id,
                    documentName: row.document_name,
                    content: row.content,
                    similarity: row.similarity,
                    pageNumber: row.page_number,
                    position: row.position,
                  })),
          complete: (value, sources) =>
            providerConfig
              ? createChatCompletionWithProviderConfig(
                  buildRagMessages(value, sources),
                  providerConfig,
                )
              : createLocalGroundedCompletion(value, sources),
          saveConversation: async (input) => {
            const conversation = localDemoStore.createConversation({
              question: input.question,
              answer: input.answer,
              status: input.status,
              top_similarity: input.topSimilarity,
              latency_ms: input.latencyMs,
              prompt_tokens: input.usage?.promptTokens ?? null,
              completion_tokens: input.usage?.completionTokens ?? null,
              total_tokens: input.usage?.totalTokens ?? null,
              model: input.model,
            });

            return conversation.id;
          },
          saveCitations: async (conversationId, citations) => {
            localDemoStore.createCitations(
              conversationId,
              citations.map((citation) => ({
                chunk_id: citation.chunkId,
                similarity: citation.similarity,
                snippet: citation.content.slice(0, 500),
                label: citation.label,
              })),
            );
          },
          createTicket: async (input) => {
            const ticket = localDemoStore.createTicket({
              conversation_id: input.conversationId,
              question: input.question,
              trigger_reason: input.triggerReason,
              ai_assessment: input.aiAssessment,
            });

            return ticket.id;
          },
        },
        { minSimilarity: localMinSimilarity },
      );

      return NextResponse.json({ ...response, mode: "local-demo" });
    }

    if (!supabaseConfigured) {
      return productionPersistenceUnavailable();
    }

    const supabase = getSupabaseAdmin();
    const customerSession = await getOrCreateCustomerSession(request, supabase);

    const response = await answerQuestionWithRag(
      question,
      {
        embedQuestion: (value) => createEmbedding(value),
        matchChunks: async (embedding) => {
          const { data, error } = await supabase.rpc("match_document_chunks", {
            query_embedding: toPgVector(embedding),
            match_count: config.RAG_TOP_K,
            min_similarity: config.RAG_MIN_SIMILARITY,
          });

          if (error) {
            throw error;
          }

          return ((data ?? []) as Array<Record<string, unknown>>).map(
            (row, index) =>
              ({
                label: `S${index + 1}`,
                chunkId: String(row.chunk_id),
                documentId: String(row.document_id),
                documentName: String(row.document_name),
                content: String(row.content),
                similarity: Number(row.similarity),
                pageNumber:
                  row.page_number === null || row.page_number === undefined
                    ? null
                    : Number(row.page_number),
                position:
                  row.position === null || row.position === undefined
                    ? null
                    : Number(row.position),
              }) satisfies SourceChunk,
          );
        },
        complete: (value, sources) =>
          providerConfig
            ? createChatCompletionWithProviderConfig(
                buildRagMessages(value, sources),
                providerConfig,
              )
            : createChatCompletion(buildRagMessages(value, sources)),
        saveConversation: async (input) => {
          const { data, error } = await supabase
            .from("conversations")
            .insert({
              session_id: customerSession.id,
              question: input.question,
              answer: input.answer,
              status: input.status satisfies ConversationStatus,
              top_similarity: input.topSimilarity,
              latency_ms: input.latencyMs,
              prompt_tokens: input.usage?.promptTokens ?? null,
              completion_tokens: input.usage?.completionTokens ?? null,
              total_tokens: input.usage?.totalTokens ?? null,
              model: input.model,
            })
            .select("id")
            .single();

          if (error) {
            throw error;
          }

          return data.id as string;
        },
        saveCitations: async (conversationId, citations) => {
          if (!citations.length) {
            return;
          }

          const { error } = await supabase.from("citations").insert(
            citations.map((citation) => ({
              conversation_id: conversationId,
              chunk_id: citation.chunkId,
              similarity: citation.similarity,
              snippet: citation.content.slice(0, 500),
              label: citation.label,
            })),
          );

          if (error) {
            throw error;
          }
        },
        createTicket: async (input) => {
          const { data, error } = await supabase
            .from("tickets")
            .insert({
              session_id: customerSession.id,
              conversation_id: input.conversationId,
              question: input.question,
              trigger_reason: input.triggerReason,
              ai_assessment: input.aiAssessment,
              status: "open",
            })
            .select("id")
            .single();

          if (error) {
            throw error;
          }

          return data.id as string;
        },
      },
      { minSimilarity: config.RAG_MIN_SIMILARITY },
    );

    return attachCustomerSessionCookie(NextResponse.json(response), customerSession);
  } catch (error) {
    const message =
      error instanceof Error
        ? redactSensitiveText(error.message, apiKeyForRedaction)
        : "Chat failed.";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
