import { describe, expect, it } from "vitest";

import {
  answerHasValidCitation,
  extractCitationLabels,
  getValidCitations,
  type SourceChunk,
} from "@/lib/rag/citations";

const sources: SourceChunk[] = [
  {
    label: "S1",
    chunkId: "chunk-1",
    documentId: "doc-1",
    documentName: "FAQ",
    content: "退款规则",
    similarity: 0.91,
    pageNumber: null,
    position: 0,
  },
];

describe("citation helpers", () => {
  it("extracts citation labels without duplicates", () => {
    expect(extractCitationLabels("支持退款 [S1]，详情见 [S1] 和 [S2]。")).toEqual([
      "S1",
      "S2",
    ]);
  });

  it("keeps only citations backed by retrieved sources", () => {
    expect(getValidCitations("支持退款 [S1]，但 [S9] 不存在。", sources)).toEqual([
      sources[0],
    ]);
    expect(answerHasValidCitation("没有来源", sources)).toBe(false);
  });
});
