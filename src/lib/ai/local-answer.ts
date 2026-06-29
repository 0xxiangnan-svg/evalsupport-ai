import type { ChatCompletionResult } from "@/lib/ai/openai-compatible";
import type { SourceChunk } from "@/lib/rag/citations";

export async function createLocalGroundedCompletion(
  question: string,
  sources: SourceChunk[],
): Promise<ChatCompletionResult> {
  const primary = sources[0];
  const bestSentence = selectBestSentence(question, primary.content);

  return {
    text: `根据知识库，${bestSentence} [${primary.label}]`,
    model: "local-demo-grounded-answer",
    usage: {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    },
  };
}

function selectBestSentence(question: string, content: string) {
  const sentences = content
    .split(/(?<=[。！？.!?])\s+|[\r\n]+/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return content.slice(0, 180);
  }

  return sentences
    .map((sentence) => ({
      sentence,
      score: lexicalScore(question, sentence),
    }))
    .sort((left, right) => right.score - left.score)[0].sentence;
}

function lexicalScore(question: string, sentence: string) {
  const questionTokens = tokenize(question);
  const sentenceTokens = tokenize(sentence);
  let overlap = 0;

  for (const token of questionTokens) {
    if (sentenceTokens.has(token)) {
      overlap += 1;
    }
  }

  return questionTokens.size ? overlap / questionTokens.size : 0;
}

function tokenize(value: string) {
  const tokens = new Set<string>();
  const groups = value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

  for (const group of groups) {
    const chars = Array.from(group);
    if (chars.some((char) => /\p{Script=Han}/u.test(char))) {
      for (const char of chars) {
        tokens.add(char);
      }
      for (let index = 0; index < chars.length - 1; index += 1) {
        tokens.add(`${chars[index]}${chars[index + 1]}`);
      }
    } else {
      tokens.add(group);
    }
  }

  return tokens;
}
