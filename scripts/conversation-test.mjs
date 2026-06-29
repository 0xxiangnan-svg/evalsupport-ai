const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const MOCK_AI_URL = process.env.MOCK_AI_URL ?? "http://127.0.0.1:4010/v1";

const demoChunks = [
  {
    chunkId: "conv_chunk_invoice",
    documentId: "conv_doc_faq",
    documentName: "EvalSupport 企业客服 FAQ.md",
    content:
      "发票规则：年付订单在付款成功后的 1 个工作日内开具电子发票，月付订单在每月账单确认后的 3 个工作日内开具。",
    pageNumber: null,
    position: 0,
  },
  {
    chunkId: "conv_chunk_trial",
    documentId: "conv_doc_faq",
    documentName: "EvalSupport 企业客服 FAQ.md",
    content:
      "套餐说明：标准版试用期为 14 天，企业版试用期为 30 天。试用期结束前 3 天会提醒管理员续费或升级。",
    pageNumber: null,
    position: 1,
  },
  {
    chunkId: "conv_chunk_ticket",
    documentId: "conv_doc_faq",
    documentName: "EvalSupport 企业客服 FAQ.md",
    content:
      "工单兜底：当知识库没有相关来源、相似度过低或模型没有输出引用时，系统会创建工单并提示人工处理。",
    pageNumber: null,
    position: 2,
  },
];

const providerConfig = {
  baseUrl: MOCK_AI_URL,
  apiKey: "mock-browser-key",
  chatModel: "mock-chat",
};

const transcript = [];
let cookieHeader = "";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function rememberCookie(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    return;
  }

  cookieHeader = setCookie
    .split(",")
    .map((item) => item.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function jsonFetch(path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (cookieHeader && !headers.has("cookie")) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers,
  });
  rememberCookie(response);

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(
      `${path} returned ${response.status}: ${
        typeof payload === "string" ? payload : JSON.stringify(payload)
      }`,
    );
  }

  return payload;
}

async function chat(question, extra = {}) {
  const payload = await jsonFetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question,
      demoChunks,
      ...extra,
    }),
  });

  transcript.push({
    question,
    status: payload.status,
    answer: payload.answer,
    citationCount: payload.citations?.length ?? 0,
    ticketReason: payload.ticket?.triggerReason ?? null,
    model: payload.metrics?.model ?? null,
  });

  return payload;
}

async function runScenario(name, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    console.log(`PASS ${name} (${Date.now() - startedAt}ms)`);
    console.log(`  ${JSON.stringify(result)}`);
  } catch (error) {
    console.error(`FAIL ${name} (${Date.now() - startedAt}ms)`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

await runScenario("local answer cites invoice source", async () => {
  const payload = await chat("年付订单什么时候开发票？");
  assert(payload.status === "answered", "expected answered status");
  assert(payload.answer.includes("[S1]"), "expected [S1] citation");
  assert(payload.citations?.[0]?.documentName.includes("FAQ"), "expected FAQ source");
  return {
    status: payload.status,
    citation: payload.citations[0].label,
    model: payload.metrics.model,
  };
});

await runScenario("local answer cites trial source", async () => {
  const payload = await chat("标准版试用期多久？");
  assert(payload.status === "answered", "expected answered status");
  assert(payload.answer.includes("[S1]"), "expected [S1] citation");
  assert(payload.answer.includes("14"), "expected trial duration in answer");
  return {
    status: payload.status,
    answer: payload.answer,
  };
});

await runScenario("out-of-scope question creates ticket", async () => {
  const payload = await chat("今天北京天气怎么样？");
  assert(payload.status === "ticket_created", "expected ticket_created status");
  assert(payload.citations.length === 0, "expected no citations");
  assert(payload.ticket?.triggerReason === "no_citations", "expected no_citations");
  return {
    status: payload.status,
    triggerReason: payload.ticket.triggerReason,
  };
});

await runScenario("BYOK mock provider overrides local model", async () => {
  const payload = await chat("什么情况下会自动创建工单？", {
    providerConfig,
  });
  assert(payload.status === "answered", "expected answered status");
  assert(payload.metrics.model === "mock-chat", "expected mock-chat model");
  assert(payload.metrics.totalTokens === 18, "expected mock token usage");
  assert(payload.answer.includes("[S1]"), "expected cited mock answer");
  return {
    status: payload.status,
    model: payload.metrics.model,
    totalTokens: payload.metrics.totalTokens,
  };
});

await runScenario("conversation history is queryable", async () => {
  const payload = await jsonFetch("/api/conversations");
  const conversations = Array.isArray(payload.conversations)
    ? payload.conversations
    : payload;
  assert(Array.isArray(conversations), "expected conversations array");
  assert(conversations.length >= 4, "expected at least four conversation records");
  const serialized = JSON.stringify(conversations);
  assert(!serialized.includes("mock-browser-key"), "history must not expose API key");
  return {
    count: conversations.length,
    exposesApiKey: false,
  };
});

console.log("\nConversation transcript:");
for (const item of transcript) {
  console.log(
    `- ${item.question} -> ${item.status}, citations=${item.citationCount}, ticket=${item.ticketReason ?? "none"}, model=${item.model ?? "none"}`,
  );
}

if (!process.exitCode) {
  console.log("\nConversation test passed.");
}
