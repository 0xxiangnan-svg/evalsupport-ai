import { describe, expect, it } from "vitest";

import {
  buildFallbackAnswer,
  getRetrievalFallbackReason,
} from "@/lib/rag/confidence";

describe("confidence rules", () => {
  it("falls back when no citations are available", () => {
    expect(
      getRetrievalFallbackReason({
        topSimilarity: null,
        sourceCount: 0,
        minSimilarity: 0.72,
      }),
    ).toBe("no_citations");
  });

  it("falls back when top similarity is too low", () => {
    expect(
      getRetrievalFallbackReason({
        topSimilarity: 0.4,
        sourceCount: 2,
        minSimilarity: 0.72,
      }),
    ).toBe("low_similarity");
  });

  it("allows high-confidence retrieved sources", () => {
    expect(
      getRetrievalFallbackReason({
        topSimilarity: 0.9,
        sourceCount: 2,
        minSimilarity: 0.72,
      }),
    ).toBeNull();
  });

  it("builds deterministic fallback answers", () => {
    expect(buildFallbackAnswer("missing_model_citation")).toContain("创建工单");
  });
});
