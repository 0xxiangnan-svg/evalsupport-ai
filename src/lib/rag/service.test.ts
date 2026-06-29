import { describe, expect, it, vi } from "vitest";

import type { SourceChunk } from "@/lib/rag/citations";
import {
  answerQuestionWithRag,
  type RagServiceDeps,
} from "@/lib/rag/service";

const source: SourceChunk = {
  label: "S1",
  chunkId: "chunk-1",
  documentId: "doc-1",
  documentName: "退货政策",
  content: "7 天内可以退货。",
  similarity: 0.92,
  pageNumber: null,
  position: 0,
};

function createDeps(overrides: Partial<RagServiceDeps> = {}): RagServiceDeps {
  return {
    embedQuestion: vi.fn(async () => [1, 0, 0]),
    matchChunks: vi.fn(async () => [source]),
    complete: vi.fn(async () => ({
      text: "商品签收后 7 天内可以申请退货。[S1]",
      model: "deepseek-chat",
      usage: {
        promptTokens: 10,
        completionTokens: 12,
        totalTokens: 22,
      },
    })),
    saveConversation: vi.fn(async () => "conversation-1"),
    saveCitations: vi.fn(async () => undefined),
    createTicket: vi.fn(async () => "ticket-1"),
    ...overrides,
  };
}

describe("answerQuestionWithRag", () => {
  it("answers and saves citations when retrieval and model citations are valid", async () => {
    const deps = createDeps();

    const result = await answerQuestionWithRag("可以退货吗？", deps, {
      minSimilarity: 0.72,
    });

    expect(result.status).toBe("answered");
    expect(result.citations).toEqual([source]);
    expect(deps.saveCitations).toHaveBeenCalledWith("conversation-1", [source]);
    expect(deps.createTicket).not.toHaveBeenCalled();
  });

  it("creates a ticket when retrieval confidence is too low", async () => {
    const deps = createDeps({
      matchChunks: vi.fn(async () => [{ ...source, similarity: 0.2 }]),
    });

    const result = await answerQuestionWithRag("可以退货吗？", deps, {
      minSimilarity: 0.72,
    });

    expect(result.status).toBe("ticket_created");
    expect(result.ticket?.triggerReason).toBe("low_similarity");
    expect(deps.complete).not.toHaveBeenCalled();
    expect(deps.createTicket).toHaveBeenCalled();
  });

  it("creates a ticket when the model answer has no valid citation", async () => {
    const deps = createDeps({
      complete: vi.fn(async () => ({
        text: "可以退货。",
        model: "deepseek-chat",
        usage: {
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
        },
      })),
    });

    const result = await answerQuestionWithRag("可以退货吗？", deps, {
      minSimilarity: 0.72,
    });

    expect(result.status).toBe("ticket_created");
    expect(result.ticket?.triggerReason).toBe("missing_model_citation");
    expect(deps.saveCitations).not.toHaveBeenCalled();
  });
});
