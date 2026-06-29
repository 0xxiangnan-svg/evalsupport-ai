import { createLocalGroundedCompletion } from "@/lib/ai/local-answer";
import { SAMPLE_DEMO_CHUNKS } from "@/lib/local-demo/session";
import { scoreTextSimilarity } from "@/lib/local-demo/store";
import { buildFallbackAnswer } from "@/lib/rag/confidence";
import type { SourceChunk } from "@/lib/rag/citations";

type ExpectedBehavior = "answer" | "refuse";

type LocalEvalCase = {
  id: string;
  question: string;
  expectedBehavior: ExpectedBehavior;
  expectedChunkId: string | null;
  category: "answerable" | "refusal" | "distractor";
};

export type LocalEvalCaseResult = {
  caseId: string;
  question: string;
  category: LocalEvalCase["category"];
  expectedBehavior: ExpectedBehavior;
  expectedChunkId: string | null;
  predictedStatus: "answered" | "ticket_created";
  predictedChunkId: string | null;
  topSimilarity: number | null;
  answer: string;
  citationCorrect: boolean | null;
  refusalCorrect: boolean | null;
  answerUsable: boolean;
  note: string;
};

const MIN_EVAL_SIMILARITY = 0.28;

const LOCAL_EVAL_CASES: LocalEvalCase[] = [
  {
    id: "eval_invoice_01",
    question: "年付订单什么时候开发票？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_invoice",
    category: "answerable",
  },
  {
    id: "eval_invoice_02",
    question: "月付订单几天内开票？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_invoice",
    category: "answerable",
  },
  {
    id: "eval_invoice_03",
    question: "在哪里下载发票？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_invoice",
    category: "answerable",
  },
  {
    id: "eval_trial_01",
    question: "标准版试用期多久？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_trial",
    category: "answerable",
  },
  {
    id: "eval_trial_02",
    question: "企业版可以试用多少天？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_trial",
    category: "answerable",
  },
  {
    id: "eval_trial_03",
    question: "试用期默认限制几个管理员席位？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_trial",
    category: "answerable",
  },
  {
    id: "eval_ticket_01",
    question: "什么情况下会自动创建工单？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_ticket",
    category: "answerable",
  },
  {
    id: "eval_ticket_02",
    question: "模型回答没有来源标签时系统会怎么处理？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_ticket",
    category: "answerable",
  },
  {
    id: "eval_ticket_03",
    question: "Top 1 相似度低于阈值时会强答吗？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_ticket",
    category: "answerable",
  },
  {
    id: "eval_security_01",
    question: "用户自带 API Key 会保存到数据库吗？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_security",
    category: "answerable",
  },
  {
    id: "eval_security_02",
    question: "API Key 保存在什么地方？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_security",
    category: "answerable",
  },
  {
    id: "eval_security_03",
    question: "对话时用户 API Key 会怎么使用？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_security",
    category: "answerable",
  },
  {
    id: "eval_refuse_01",
    question: "今天北京天气怎么样？",
    expectedBehavior: "refuse",
    expectedChunkId: null,
    category: "refusal",
  },
  {
    id: "eval_refuse_02",
    question: "帮我写一首七言绝句",
    expectedBehavior: "refuse",
    expectedChunkId: null,
    category: "refusal",
  },
  {
    id: "eval_refuse_03",
    question: "OpenAI 最新股价是多少？",
    expectedBehavior: "refuse",
    expectedChunkId: null,
    category: "refusal",
  },
  {
    id: "eval_refuse_04",
    question: "明天上海会下雨吗？",
    expectedBehavior: "refuse",
    expectedChunkId: null,
    category: "refusal",
  },
  {
    id: "eval_refuse_05",
    question: "推荐一家附近的火锅店",
    expectedBehavior: "refuse",
    expectedChunkId: null,
    category: "refusal",
  },
  {
    id: "eval_distractor_01",
    question: "企业版是不是 14 天试用？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_trial",
    category: "distractor",
  },
  {
    id: "eval_distractor_02",
    question: "API Key 会写入工单吗？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_security",
    category: "distractor",
  },
  {
    id: "eval_distractor_03",
    question: "没有来源时是否还会给确定答案？",
    expectedBehavior: "answer",
    expectedChunkId: "demo_chunk_ticket",
    category: "distractor",
  },
];

export async function runLocalDemoEval() {
  const results: LocalEvalCaseResult[] = [];

  for (const evalCase of LOCAL_EVAL_CASES) {
    results.push(await evaluateCase(evalCase));
  }

  const answerCases = results.filter(
    (result) => result.expectedBehavior === "answer",
  );
  const refusalCases = results.filter(
    (result) => result.expectedBehavior === "refuse",
  );

  return {
    status: "completed",
    total_cases: results.length,
    citation_accuracy: ratio(
      answerCases.filter((result) => result.citationCorrect === true).length,
      answerCases.length,
    ),
    refusal_accuracy: ratio(
      refusalCases.filter((result) => result.refusalCorrect === true).length,
      refusalCases.length,
    ),
    answer_usability: ratio(
      results.filter((result) => result.answerUsable).length,
      results.length,
    ),
    results,
    notes:
      "Local deterministic eval over 20 fixed cases: 12 answerable, 5 refusal, 3 distractor.",
  };
}

async function evaluateCase(evalCase: LocalEvalCase) {
  const topSource = findTopSource(evalCase.question);

  if (!topSource || topSource.similarity < MIN_EVAL_SIMILARITY) {
    return {
      caseId: evalCase.id,
      question: evalCase.question,
      category: evalCase.category,
      expectedBehavior: evalCase.expectedBehavior,
      expectedChunkId: evalCase.expectedChunkId,
      predictedStatus: "ticket_created",
      predictedChunkId: null,
      topSimilarity: topSource?.similarity ?? null,
      answer: buildFallbackAnswer("no_citations"),
      citationCorrect: evalCase.expectedBehavior === "answer" ? false : null,
      refusalCorrect: evalCase.expectedBehavior === "refuse",
      answerUsable: evalCase.expectedBehavior === "refuse",
      note: topSource
        ? "Top source below eval similarity threshold."
        : "No source matched the eval question.",
    } satisfies LocalEvalCaseResult;
  }

  const completion = await createLocalGroundedCompletion(evalCase.question, [
    topSource,
  ]);
  const citationCorrect =
    evalCase.expectedBehavior === "answer" &&
    topSource.chunkId === evalCase.expectedChunkId &&
    completion.text.includes(`[${topSource.label}]`);

  return {
    caseId: evalCase.id,
    question: evalCase.question,
    category: evalCase.category,
    expectedBehavior: evalCase.expectedBehavior,
    expectedChunkId: evalCase.expectedChunkId,
    predictedStatus: "answered",
    predictedChunkId: topSource.chunkId,
    topSimilarity: topSource.similarity,
    answer: completion.text,
    citationCorrect: evalCase.expectedBehavior === "answer" ? citationCorrect : null,
    refusalCorrect: evalCase.expectedBehavior === "refuse" ? false : null,
    answerUsable: evalCase.expectedBehavior === "answer" && citationCorrect,
    note: citationCorrect
      ? "Matched expected source and produced a valid citation."
      : "Answered, but did not match the expected eval behavior or source.",
  } satisfies LocalEvalCaseResult;
}

function findTopSource(question: string) {
  return SAMPLE_DEMO_CHUNKS.map((chunk, index) => ({
    label: `S${index + 1}`,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    content: chunk.content,
    similarity: scoreTextSimilarity(question, chunk.content),
    pageNumber: chunk.pageNumber,
    position: chunk.position,
  }))
    .sort((left, right) => right.similarity - left.similarity)[0] as
    | SourceChunk
    | undefined;
}

function ratio(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : null;
}
