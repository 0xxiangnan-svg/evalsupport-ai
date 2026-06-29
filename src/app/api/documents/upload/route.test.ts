import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/documents/upload/route";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const mocks = vi.hoisted(() => ({
  hasSupabaseConfig: vi.fn(() => true),
  shouldUseLocalDemo: vi.fn(() => false),
}));

vi.mock("@/lib/config", () => ({
  getConfig: () => ({
    SUPABASE_STORAGE_BUCKET: "knowledge-base",
  }),
  hasSupabaseConfig: () => mocks.hasSupabaseConfig(),
  shouldUseLocalDemo: () => mocks.shouldUseLocalDemo(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("POST /api/documents/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasSupabaseConfig.mockReturnValue(true);
    mocks.shouldUseLocalDemo.mockReturnValue(false);
  });

  it("uploads a supported document and creates a document record", async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "doc-1",
            filename: "客服政策.md",
            file_type: "md",
            status: "uploaded",
          },
          error: null,
        })),
      })),
    }));

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      storage: {
        from: vi.fn(() => ({ upload })),
      },
      from: vi.fn(() => ({ insert })),
    } as never);

    const formData = new FormData();
    formData.set(
      "file",
      new File(["退款政策"], "客服政策.md", { type: "text/markdown" }),
    );

    const response = await POST({
      formData: async () => formData,
    } as Request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.document.status).toBe("uploaded");
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^documents\/.+-客服政策\.md$/),
      expect.any(File),
      expect.objectContaining({ contentType: "text/markdown" }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "客服政策.md",
        file_type: "md",
        status: "uploaded",
      }),
    );
  });

  it("rejects unsupported document types", async () => {
    const formData = new FormData();
    formData.set("file", new File(["zip"], "backup.zip"));

    const response = await POST({
      formData: async () => formData,
    } as Request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Only .pdf, .md, and .txt");
  });

  it("returns 503 in production when Supabase is not configured", async () => {
    mocks.hasSupabaseConfig.mockReturnValue(false);
    mocks.shouldUseLocalDemo.mockReturnValue(false);

    const formData = new FormData();
    formData.set("file", new File(["退款政策"], "客服政策.md"));

    const response = await POST({
      formData: async () => formData,
    } as Request);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toContain("Production persistence is not configured");
  });
});
