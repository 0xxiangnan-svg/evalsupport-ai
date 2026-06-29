import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/chat/route";
import {
  createChatCompletion,
  createChatCompletionWithProviderConfig,
  createEmbedding,
} from "@/lib/ai/openai-compatible";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const mocks = vi.hoisted(() => ({
  hasSupabaseConfig: vi.fn(() => true),
  shouldUseLocalDemo: vi.fn(() => false),
  getOrCreateCustomerSession: vi.fn(async () => ({
    id: "session-1",
    tokenHash: "abcdef123456",
    label: "sess_abcdef",
    setCookieHeader: "evalsupport_session=test; Path=/; HttpOnly",
  })),
  attachCustomerSessionCookie: vi.fn((response: unknown) => response),
}));

vi.mock("@/lib/config", () => ({
  getConfig: () => ({
    RAG_TOP_K: 5,
    RAG_MIN_SIMILARITY: 0.72,
  }),
  hasSupabaseConfig: () => mocks.hasSupabaseConfig(),
  shouldUseLocalDemo: () => mocks.shouldUseLocalDemo(),
}));

vi.mock("@/lib/customer-session", () => ({
  getOrCreateCustomerSession: mocks.getOrCreateCustomerSession,
  attachCustomerSessionCookie: mocks.attachCustomerSessionCookie,
}));

vi.mock("@/lib/ai/openai-compatible", () => ({
  createEmbedding: vi.fn(),
  createChatCompletion: vi.fn(),
  createChatCompletionWithProviderConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn(),
}));

function createInsertBuilder(id: string) {
  return {
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id }, error: null })),
    })),
  };
}

function createSupabaseMock(matchData: Array<Record<string, unknown>>) {
  const insertCalls: Record<string, unknown[]> = {};

  return {
    insertCalls,
    rpc: vi.fn(async () => ({ data: matchData, error: null })),
    from: vi.fn((table: string) => {
      if (table === "citations") {
        return {
          insert: vi.fn(async (value) => {
            insertCalls[table] = [...(insertCalls[table] ?? []), value];
            return { error: null };
          }),
        };
      }

      return {
        insert: vi.fn((value) => {
          insertCalls[table] = [...(insertCalls[table] ?? []), value];
          return createInsertBuilder(
            table === "tickets" ? "ticket-1" : "conversation-1",
          );
        }),
      };
    }),
  };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasSupabaseConfig.mockReturnValue(true);
    mocks.shouldUseLocalDemo.mockReturnValue(false);
    vi.mocked(createEmbedding).mockResolvedValue([1, 0, 0]);
  });

  it("returns an answer with citations when retrieval and model output are valid", async () => {
    const supabase = createSupabaseMock([
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          document_name: "FAQ",
          content: "年付订单 1 个工作日内开具电子发票。",
          page_number: null,
          position: 0,
          similarity: 0.91,
        },
      ]);
    vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
    vi.mocked(createChatCompletion).mockResolvedValue({
      text: "年付订单在付款成功后的 1 个工作日内开具电子发票。[S1]",
      model: "deepseek-chat",
      usage: {
        promptTokens: 8,
        completionTokens: 12,
        totalTokens: 20,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ question: "年付订单什么时候开发票？" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("answered");
    expect(payload.citations).toHaveLength(1);
    expect(payload.ticket).toBeNull();
    expect(supabase.insertCalls.conversations[0]).toEqual(
      expect.objectContaining({ session_id: "session-1" }),
    );
  });

  it("uses request provider config instead of the server chat provider", async () => {
    const supabase = createSupabaseMock([
      {
        chunk_id: "chunk-1",
        document_id: "doc-1",
        document_name: "FAQ",
        content: "标准版支持 14 天免费试用。",
        page_number: null,
        position: 0,
        similarity: 0.91,
      },
    ]);
    vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
    vi.mocked(createChatCompletionWithProviderConfig).mockResolvedValue({
      text: "标准版支持 14 天免费试用。[S1]",
      model: "user-model",
      usage: {
        promptTokens: 6,
        completionTokens: 8,
        totalTokens: 14,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          question: "标准版试用期多久？",
          providerConfig: {
            baseUrl: "https://api.example.com/v1",
            apiKey: "custom-secret-token",
            chatModel: "user-model",
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("answered");
    expect(payload.metrics.model).toBe("user-model");
    expect(createChatCompletion).not.toHaveBeenCalled();
    expect(createChatCompletionWithProviderConfig).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        baseUrl: "https://api.example.com/v1",
        apiKey: "custom-secret-token",
        chatModel: "user-model",
      }),
    );
  });

  it("creates a ticket when retrieval returns no usable source", async () => {
    const supabase = createSupabaseMock([]);
    vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ question: "今天北京天气怎么样？" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ticket_created");
    expect(payload.ticket.triggerReason).toBe("no_citations");
    expect(createChatCompletion).not.toHaveBeenCalled();
    expect(supabase.insertCalls.tickets[0]).toEqual(
      expect.objectContaining({ session_id: "session-1" }),
    );
  });

  it("returns 503 in production when Supabase is not configured", async () => {
    mocks.hasSupabaseConfig.mockReturnValue(false);
    mocks.shouldUseLocalDemo.mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ question: "年付订单什么时候开发票？" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toContain("Production persistence is not configured");
    expect(createChatCompletion).not.toHaveBeenCalled();
  });
});
