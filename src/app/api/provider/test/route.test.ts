import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/provider/test/route";
import { createChatCompletionWithProviderConfig } from "@/lib/ai/openai-compatible";

vi.mock("@/lib/ai/openai-compatible", () => ({
  createChatCompletionWithProviderConfig: vi.fn(),
}));

describe("POST /api/provider/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when the provider answers", async () => {
    vi.mocked(createChatCompletionWithProviderConfig).mockResolvedValue({
      text: "OK",
      model: "deepseek-chat",
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/provider/test", {
        method: "POST",
        body: JSON.stringify({
          providerConfig: {
            baseUrl: "https://api.deepseek.com/v1",
            apiKey: "custom-secret-token",
            chatModel: "deepseek-chat",
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, model: "deepseek-chat" });
    expect(createChatCompletionWithProviderConfig).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "custom-secret-token",
        chatModel: "deepseek-chat",
      }),
    );
  });

  it("returns a redacted error when the provider fails", async () => {
    vi.mocked(createChatCompletionWithProviderConfig).mockRejectedValue(
      new Error("invalid API key custom-secret-token"),
    );

    const response = await POST(
      new Request("http://localhost/api/provider/test", {
        method: "POST",
        body: JSON.stringify({
          providerConfig: {
            baseUrl: "https://api.deepseek.com/v1",
            apiKey: "custom-secret-token",
            chatModel: "deepseek-chat",
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("[redacted-api-key]");
    expect(payload.error).not.toContain("custom-secret-token");
  });
});
