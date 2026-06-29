import { beforeEach, describe, expect, it } from "vitest";

import { POST as chat } from "@/app/api/chat/route";
import { POST as indexDocument } from "@/app/api/documents/[id]/index/route";
import { POST as uploadDocument } from "@/app/api/documents/upload/route";
import { localDemoStore } from "@/lib/local-demo/store";

describe("local demo API flow", () => {
  beforeEach(() => {
    localDemoStore.reset();
  });

  it("uploads, indexes, answers with citations, and creates fallback tickets without Supabase", async () => {
    const formData = new FormData();
    formData.set(
      "file",
      new File(
        [
          "年付订单在付款成功后的 1 个工作日内开具电子发票。标准版支持 14 天免费试用。",
        ],
        "sample.md",
        { type: "text/markdown" },
      ),
    );

    const uploadResponse = await uploadDocument({
      formData: async () => formData,
    } as Request);
    const uploadPayload = await uploadResponse.json();

    expect(uploadResponse.status).toBe(200);
    expect(uploadPayload.mode).toBe("local-demo");

    const documentId = uploadPayload.document.id as string;
    const indexResponse = await indexDocument(new Request("http://localhost"), {
      params: Promise.resolve({ id: documentId }),
    });
    const indexPayload = await indexResponse.json();

    expect(indexResponse.status).toBe(200);
    expect(indexPayload.chunkCount).toBe(1);

    const answerResponse = await chat(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ question: "年付订单什么时候开发票？" }),
      }),
    );
    const answerPayload = await answerResponse.json();

    expect(answerResponse.status).toBe(200);
    expect(answerPayload.status).toBe("answered");
    expect(answerPayload.answer).toContain("[S1]");
    expect(answerPayload.citations).toHaveLength(1);

    const fallbackResponse = await chat(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ question: "今天北京天气怎么样？" }),
      }),
    );
    const fallbackPayload = await fallbackResponse.json();

    expect(fallbackResponse.status).toBe(200);
    expect(fallbackPayload.status).toBe("ticket_created");
    expect(fallbackPayload.ticket.id).toContain("ticket_");
    expect(localDemoStore.listConversations()).toHaveLength(2);
    expect(localDemoStore.listTickets()).toHaveLength(1);
  });

  it("answers from request-scoped demo chunks without server memory", async () => {
    const answerResponse = await chat(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          question: "年付订单什么时候开发票？",
          demoChunks: [
            {
              chunkId: "chunk-browser-1",
              documentId: "doc-browser-1",
              documentName: "browser-demo.md",
              content: "年付订单在付款成功后的 1 个工作日内开具电子发票。",
              pageNumber: null,
              position: 0,
            },
          ],
        }),
      }),
    );
    const answerPayload = await answerResponse.json();

    expect(answerResponse.status).toBe(200);
    expect(answerPayload.status).toBe("answered");
    expect(answerPayload.answer).toContain("[S1]");
    expect(answerPayload.citations[0].chunkId).toBe("chunk-browser-1");
  });
});
