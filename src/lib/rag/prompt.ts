import type { SourceChunk } from "@/lib/rag/citations";

export function buildRagMessages(question: string, sources: SourceChunk[]) {
  const context = sources
    .map(
      (source) =>
        `[${source.label}] 文档：${source.documentName}\n位置：${
          source.pageNumber ? `第 ${source.pageNumber} 页` : `chunk ${source.position ?? "-"}`
        }\n内容：${source.content}`,
    )
    .join("\n\n---\n\n");

  return [
    {
      role: "system" as const,
      content:
        "你是 EvalSupport AI 的企业客服知识库助手。只能基于提供的知识库片段回答。回答必须使用中文，事实性结论后必须带 [S1] 这类来源引用。若资料不足，不要编造。",
    },
    {
      role: "user" as const,
      content: `用户问题：${question}\n\n知识库片段：\n${context}\n\n请给出简洁、可执行的客服答复，并在每个关键结论后标注来源。`,
    },
  ];
}
