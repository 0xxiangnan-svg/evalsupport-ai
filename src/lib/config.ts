import { z } from "zod";

const numberFromEnv = (fallback: number) =>
  z.coerce.number().finite().positive().catch(fallback);

const envSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).catch("knowledge-base"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z
    .string()
    .url()
    .catch("https://api.deepseek.com/v1"),
  CHAT_MODEL: z.string().min(1).catch("deepseek-chat"),
  EMBEDDING_PROVIDER: z.enum(["remote", "local"]).catch("local"),
  EMBEDDING_MODEL: z.string().min(1).catch("text-embedding-3-small"),
  EMBEDDING_DIM: numberFromEnv(1536),
  RAG_TOP_K: numberFromEnv(5),
  RAG_MIN_SIMILARITY: numberFromEnv(0.72),
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

export function getConfig() {
  if (!cachedConfig) {
    cachedConfig = envSchema.parse(process.env);
  }

  return cachedConfig;
}

export function hasSupabaseConfig() {
  const config = getConfig();
  return Boolean(config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY);
}

export function isProductionDeployment() {
  return process.env.VERCEL_ENV === "production";
}

export function shouldUseLocalDemo() {
  return !hasSupabaseConfig() && !isProductionDeployment();
}

export function requireSupabaseConfig() {
  const config = getConfig();
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.",
    );
  }

  return config;
}

export function requireRemoteAiConfig() {
  const config = getConfig();
  if (!config.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }

  return config;
}
