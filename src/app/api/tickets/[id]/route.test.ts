import { describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/tickets/[id]/route";
import { getSupabaseAdmin } from "@/lib/supabase/server";

vi.mock("@/lib/config", () => ({
  hasSupabaseConfig: () => true,
  shouldUseLocalDemo: () => false,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("PATCH /api/tickets/:id", () => {
  it("updates ticket status", async () => {
    const single = vi.fn(async () => ({
      data: { id: "ticket-1", status: "resolved" },
      error: null,
    }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/tickets/ticket-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "resolved" }),
      }),
      { params: Promise.resolve({ id: "ticket-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ticket.status).toBe("resolved");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "resolved" }),
    );
  });
});
