import { getConfig, requireRemoteAiConfig } from "@/lib/config";
import type { ProviderConfig } from "@/lib/ai/provider-config";
import { redactSensitiveText } from "@/lib/ai/provider-config";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionResult = {
  text: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  model: string;
};

type ChatCompletionResponse = {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type EmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const config = requireRemoteAiConfig();
  const apiKey = config.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }

  return postJsonWithProvider<T>(
    {
      baseUrl: config.OPENAI_BASE_URL,
      apiKey,
      chatModel: config.CHAT_MODEL,
    },
    path,
    body,
    signal,
  );
}

async function postJsonWithProvider<T>(
  provider: ProviderConfig,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const response = await fetch(joinUrl(provider.baseUrl, path), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const safeText = redactSensitiveText(errorText, provider.apiKey);
    throw new Error(
      `AI API request failed: ${response.status} ${response.statusText} ${safeText.slice(0, 400)}`,
    );
  }

  return (await response.json()) as T;
}

export async function createChatCompletion(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<ChatCompletionResult> {
  const config = requireRemoteAiConfig();
  const result = await postJson<ChatCompletionResponse>(
    "/chat/completions",
    {
      model: config.CHAT_MODEL,
      messages,
      temperature: 0.2,
    },
    signal,
  );

  const text = result.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("AI API returned an empty chat completion.");
  }

  return {
    text,
    model: result.model ?? config.CHAT_MODEL,
    usage: {
      promptTokens: result.usage?.prompt_tokens ?? null,
      completionTokens: result.usage?.completion_tokens ?? null,
      totalTokens: result.usage?.total_tokens ?? null,
    },
  };
}

export async function createChatCompletionWithProviderConfig(
  messages: ChatMessage[],
  provider: ProviderConfig,
  signal?: AbortSignal,
): Promise<ChatCompletionResult> {
  const result = await postJsonWithProvider<ChatCompletionResponse>(
    provider,
    "/chat/completions",
    {
      model: provider.chatModel,
      messages,
      temperature: 0.2,
    },
    signal,
  );

  const text = result.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("AI API returned an empty chat completion.");
  }

  return {
    text,
    model: result.model ?? provider.chatModel,
    usage: {
      promptTokens: result.usage?.prompt_tokens ?? null,
      completionTokens: result.usage?.completion_tokens ?? null,
      totalTokens: result.usage?.total_tokens ?? null,
    },
  };
}

export async function createEmbedding(value: string, signal?: AbortSignal) {
  const config = getConfig();
  if (config.EMBEDDING_PROVIDER === "local") {
    return createLocalEmbedding(value, config.EMBEDDING_DIM);
  }

  const result = await postJson<EmbeddingResponse>(
    "/embeddings",
    {
      model: config.EMBEDDING_MODEL,
      input: value,
    },
    signal,
  );

  const embedding = result.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("AI API returned an empty embedding.");
  }

  return embedding;
}

export async function createEmbeddings(values: string[], signal?: AbortSignal) {
  const config = getConfig();
  if (config.EMBEDDING_PROVIDER === "local") {
    return values.map((value) => createLocalEmbedding(value, config.EMBEDDING_DIM));
  }

  const result = await postJson<EmbeddingResponse>(
    "/embeddings",
    {
      model: config.EMBEDDING_MODEL,
      input: values,
    },
    signal,
  );

  const embeddings = result.data?.map((item) => item.embedding ?? []) ?? [];
  if (embeddings.length !== values.length || embeddings.some((item) => !item.length)) {
    throw new Error("AI API returned incomplete embeddings.");
  }

  return embeddings;
}

export function createLocalEmbedding(value: string, dimensions = 1536) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = tokenizeForLocalEmbedding(value);

  for (const token of tokens.length ? tokens : [value]) {
    let hash = 2166136261;
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    const slot = Math.abs(hash) % dimensions;
    vector[slot] += hash % 2 === 0 ? 1 : -1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  if (!magnitude) {
    return vector;
  }

  return vector.map((item) => Number((item / magnitude).toFixed(8)));
}

function tokenizeForLocalEmbedding(value: string) {
  const normalized = value.toLowerCase();
  const groups = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokens: string[] = [];

  for (const group of groups) {
    tokens.push(group);

    const chars = Array.from(group);
    if (chars.some((char) => /\p{Script=Han}/u.test(char))) {
      tokens.push(...chars);
      for (let index = 0; index < chars.length - 1; index += 1) {
        tokens.push(`${chars[index]}${chars[index + 1]}`);
      }
    }
  }

  return tokens.length ? tokens : [normalized];
}
