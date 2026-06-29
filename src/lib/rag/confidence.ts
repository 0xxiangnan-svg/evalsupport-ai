export type ConfidenceInput = {
  topSimilarity: number | null;
  sourceCount: number;
  minSimilarity: number;
};

export type FallbackReason =
  | "low_similarity"
  | "no_citations"
  | "missing_model_citation";

export function getRetrievalFallbackReason(input: ConfidenceInput) {
  if (!input.sourceCount) {
    return "no_citations" satisfies FallbackReason;
  }

  if (input.topSimilarity === null || input.topSimilarity < input.minSimilarity) {
    return "low_similarity" satisfies FallbackReason;
  }

  return null;
}

export function buildFallbackAnswer(reason: FallbackReason) {
  const reasonText =
    reason === "low_similarity"
      ? "知识库中没有找到足够相近的资料"
      : reason === "no_citations"
        ? "没有可引用的知识库片段"
        : "模型回答没有提供有效来源引用";

  return `我暂时不能基于现有知识库给出可靠回答，因为${reasonText}。我已经为这个问题创建工单，后续由人工客服补充确认。`;
}
