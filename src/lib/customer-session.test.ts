import { describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_SESSION_COOKIE,
  createSessionToken,
  getOrCreateCustomerSession,
  hashSessionToken,
} from "@/lib/customer-session";

function createSessionSupabaseMock(sessionId = "session-1") {
  const single = vi.fn(async () => ({
    data: { id: sessionId, token_hash: "abcdef1234567890" },
    error: null,
  }));
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));

  return {
    client: {
      from: vi.fn(() => ({ upsert })),
    },
    upsert,
  };
}

describe("customer session helper", () => {
  it("creates a new session and Set-Cookie header when no cookie exists", async () => {
    const supabase = createSessionSupabaseMock();

    const session = await getOrCreateCustomerSession(
      new Request("http://localhost/api/chat"),
      supabase.client as never,
    );

    expect(session.id).toBe("session-1");
    expect(session.label).toBe("sess_abcdef");
    expect(session.setCookieHeader).toContain(`${CUSTOMER_SESSION_COOKIE}=`);
    expect(session.setCookieHeader).toContain("HttpOnly");
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ token_hash: expect.any(String) }),
      { onConflict: "token_hash" },
    );
  });

  it("reuses an existing cookie without returning another Set-Cookie header", async () => {
    const supabase = createSessionSupabaseMock();
    const token = createSessionToken();

    const session = await getOrCreateCustomerSession(
      new Request("http://localhost/api/chat", {
        headers: {
          cookie: `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
        },
      }),
      supabase.client as never,
    );

    expect(session.setCookieHeader).toBeNull();
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ token_hash: hashSessionToken(token) }),
      { onConflict: "token_hash" },
    );
  });
});
