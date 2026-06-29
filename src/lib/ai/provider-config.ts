import { z } from "zod";

export const providerConfigSchema = z.object({
  baseUrl: z.string().url().max(300),
  apiKey: z.string().min(1).max(300),
  chatModel: z.string().min(1).max(120),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export function parseProviderConfig(input: unknown) {
  const config = providerConfigSchema.parse(input);
  const url = new URL(config.baseUrl);
  const isLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";

  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error(
      "Base URL must use https, except localhost and 127.0.0.1 during development.",
    );
  }

  return {
    baseUrl: url.toString().replace(/\/+$/, ""),
    apiKey: config.apiKey,
    chatModel: config.chatModel.trim(),
  } satisfies ProviderConfig;
}

export function redactSensitiveText(value: string, apiKey?: string) {
  let result = value;
  if (apiKey) {
    result = result.split(apiKey).join("[redacted-api-key]");
  }

  return result
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9._\-]+/g, "sk-[redacted]");
}
