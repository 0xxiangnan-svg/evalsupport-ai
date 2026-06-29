import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/conversations/route";
import { listConversations } from "@/lib/db/repository";

const mocks = vi.hoisted(() => ({
  hasSupabaseConfig: vi.fn(() => true),
  isProductionDeployment: vi.fn(() => false),
}));

vi.mock("@/lib/config", () => ({
  hasSupabaseConfig: () => mocks.hasSupabaseConfig(),
  isProductionDeployment: () => mocks.isProductionDeployment(),
}));

vi.mock("@/lib/db/repository", () => ({
  listConversations: vi.fn(),
}));

describe("GET /api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasSupabaseConfig.mockReturnValue(true);
    mocks.isProductionDeployment.mockReturnValue(false);
  });

  it("returns session labels without exposing token hashes", async () => {
    vi.mocked(listConversations).mockResolvedValue([
      {
        id: "conversation-1",
        question: "年付订单什么时候开发票？",
        answer: "1 个工作日内。[S1]",
        status: "answered",
        session_label: "sess_8f3a21",
      },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.conversations[0].session_label).toBe("sess_8f3a21");
    expect(JSON.stringify(payload)).not.toContain("token_hash");
  });
});
