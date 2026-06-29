import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/documents/[id]/index/route";
import { createEmbeddings } from "@/lib/ai/openai-compatible";
import { getSupabaseAdmin } from "@/lib/supabase/server";

vi.mock("@/lib/config", () => ({
  getConfig: () => ({
    SUPABASE_STORAGE_BUCKET: "knowledge-base",
  }),
  hasSupabaseConfig: () => true,
  shouldUseLocalDemo: () => false,
}));

vi.mock("@/lib/ai/openai-compatible", () => ({
  createEmbeddings: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("POST /api/documents/:id/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses, chunks, embeds, and persists indexed chunks", async () => {
    vi.mocked(createEmbeddings).mockResolvedValue([[0.1, 0.2, 0.3]]);

    const sourceDocument = {
      id: "doc-1",
      filename: "sample.md",
      file_type: "md",
      storage_path: "documents/sample.md",
    };

    const finalDocument = {
      ...sourceDocument,
      status: "indexed",
      chunk_count: 1,
    };

    const download = vi.fn(async () => ({
      data: new Blob(["年付订单在付款成功后的 1 个工作日内开具电子发票。"]),
      error: null,
    }));

    const chunkInsert = vi.fn(async () => ({ error: null }));
    const deleteChunks = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));

    const documentsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: sourceDocument, error: null })),
        })),
      })),
      update: vi.fn((values: Record<string, unknown>) => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: values.status === "indexed" ? finalDocument : sourceDocument,
              error: null,
            })),
          })),
        })),
      })),
    };

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      storage: {
        from: vi.fn(() => ({ download })),
      },
      from: vi.fn((table: string) => {
        if (table === "documents") {
          return documentsTable;
        }

        return {
          delete: deleteChunks,
          insert: chunkInsert,
        };
      }),
    } as never);

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.chunkCount).toBe(1);
    expect(createEmbeddings).toHaveBeenCalledWith([
      "年付订单在付款成功后的 1 个工作日内开具电子发票。",
    ]);
    expect(chunkInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        document_id: "doc-1",
        content: "年付订单在付款成功后的 1 个工作日内开具电子发票。",
        embedding: "[0.10000000,0.20000000,0.30000000]",
      }),
    ]);
    expect(documentsTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "indexed",
        chunk_count: 1,
      }),
    );
  });
});
