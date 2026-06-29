import { describe, expect, it } from "vitest";

import { parseProviderConfig, redactSensitiveText } from "@/lib/ai/provider-config";

describe("provider config", () => {
  it("accepts https OpenAI-compatible provider URLs", () => {
    expect(
      parseProviderConfig({
        baseUrl: "https://api.deepseek.com/v1/",
        apiKey: "test-key",
        chatModel: "deepseek-chat",
      }),
    ).toEqual({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "test-key",
      chatModel: "deepseek-chat",
    });
  });

  it("accepts localhost http URLs for development", () => {
    expect(
      parseProviderConfig({
        baseUrl: "http://localhost:11434/v1",
        apiKey: "local-key",
        chatModel: "local-model",
      }).baseUrl,
    ).toBe("http://localhost:11434/v1");
  });

  it("rejects insecure remote URLs", () => {
    expect(() =>
      parseProviderConfig({
        baseUrl: "http://example.com/v1",
        apiKey: "test-key",
        chatModel: "deepseek-chat",
      }),
    ).toThrow("Base URL must use https");
  });

  it("redacts bearer tokens and explicit API keys from errors", () => {
    const safe = redactSensitiveText(
      "Authorization failed for Bearer sk-secret and custom-token-123",
      "custom-token-123",
    );

    expect(safe).toContain("Bearer [redacted]");
    expect(safe).toContain("[redacted-api-key]");
    expect(safe).not.toContain("custom-token-123");
    expect(safe).not.toContain("sk-secret");
  });
});
