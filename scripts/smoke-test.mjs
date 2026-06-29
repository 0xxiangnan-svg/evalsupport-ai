const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";
const MOCK_AI_URL = process.env.MOCK_AI_URL ?? "http://127.0.0.1:4010/v1";

const demoChunks = [
  {
    chunkId: "demo_chunk_invoice",
    documentId: "demo_doc_evalsupport_faq",
    documentName: "EvalSupport 企业客服 FAQ.md",
    content:
      "发票规则：年付订单在付款成功后的 1 个工作日内开具电子发票，月付订单在每月账单确认后的 3 个工作日内开具。",
    pageNumber: null,
    position: 0,
  },
];

const checks = [];

async function runCheck(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    checks.push({
      name,
      status: "PASS",
      durationMs: Date.now() - startedAt,
      details,
    });
  } catch (error) {
    checks.push({
      name,
      status: "FAIL",
      durationMs: Date.now() - startedAt,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

async function jsonFetch(path, init) {
  const response = await fetch(`${APP_URL}${path}`, init);
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await runCheck("runtime status", async () => {
  const payload = await jsonFetch("/api/runtime/status");
  assert(payload.localDemoEnabled === true, "expected local demo mode");
  assert(payload.defaultProvider.embeddingProvider === "local", "expected local embeddings");
  return {
    localDemoEnabled: payload.localDemoEnabled,
    embeddingProvider: payload.defaultProvider.embeddingProvider,
  };
});

await runCheck("local demo answer with citation", async () => {
  const payload = await jsonFetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: "年付订单什么时候开发票？",
      demoChunks,
    }),
  });

  assert(payload.status === "answered", "expected answered status");
  assert(payload.answer.includes("[S1]"), "expected answer citation [S1]");
  assert(payload.citations?.length === 1, "expected one citation");
  return {
    status: payload.status,
    model: payload.metrics.model,
    citationCount: payload.citations.length,
  };
});

await runCheck("fallback ticket for out-of-scope question", async () => {
  const payload = await jsonFetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: "今天北京天气怎么样？",
      demoChunks,
    }),
  });

  assert(payload.status === "ticket_created", "expected ticket_created status");
  assert(payload.ticket?.triggerReason === "no_citations", "expected no_citations");
  return {
    status: payload.status,
    triggerReason: payload.ticket.triggerReason,
  };
});

await runCheck("BYOK provider test", async () => {
  const payload = await jsonFetch("/api/provider/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerConfig: {
        baseUrl: MOCK_AI_URL,
        apiKey: "mock-browser-key",
        chatModel: "mock-chat",
      },
    }),
  });

  assert(payload.ok === true, "expected provider ok");
  assert(payload.model === "mock-chat", "expected mock-chat model");
  return payload;
});

await runCheck("BYOK chat completion with citation", async () => {
  const payload = await jsonFetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: "年付订单什么时候开发票？",
      providerConfig: {
        baseUrl: MOCK_AI_URL,
        apiKey: "mock-browser-key",
        chatModel: "mock-chat",
      },
      demoChunks,
    }),
  });

  assert(payload.status === "answered", "expected answered status");
  assert(payload.answer.includes("[S1]"), "expected mock answer citation");
  assert(payload.metrics.model === "mock-chat", "expected mock-chat metric");
  return {
    status: payload.status,
    model: payload.metrics.model,
    totalTokens: payload.metrics.totalTokens,
  };
});

await runCheck("document upload, index, and indexed chat", async () => {
  const file = new File(
    [
      "企业版试用期为 30 天，标准版试用期为 14 天。年付订单在付款成功后 1 个工作日内开具电子发票。",
    ],
    "smoke-knowledge.md",
    { type: "text/markdown" },
  );
  const formData = new FormData();
  formData.set("file", file);

  const uploadResponse = await fetch(`${APP_URL}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });
  const uploadPayload = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(JSON.stringify(uploadPayload));
  }

  const documentId = uploadPayload.document?.id;
  assert(documentId, "expected uploaded document id");
  assert(uploadPayload.mode === "local-demo", "expected local-demo upload");

  const indexPayload = await jsonFetch(`/api/documents/${documentId}/index`, {
    method: "POST",
  });
  assert(indexPayload.chunkCount > 0, "expected indexed chunks");

  const chatPayload = await jsonFetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: "企业版试用期多久？",
    }),
  });
  assert(chatPayload.status === "answered", "expected indexed chat answer");
  assert(chatPayload.citations?.length >= 1, "expected indexed chat citation");

  return {
    documentId,
    chunkCount: indexPayload.chunkCount,
    chatStatus: chatPayload.status,
  };
});

await runCheck("eval run and detail", async () => {
  const payload = await jsonFetch("/api/evals/run", {
    method: "POST",
  });
  const run = payload.run;
  assert(payload.mode === "local-demo", "expected local-demo eval run");
  assert(run?.id, "expected eval run id");
  assert(run.status === "completed", "expected completed eval run");
  assert(run.total_cases === 20, "expected 20 local demo eval cases");
  assert(run.citation_accuracy === 1, "expected full citation accuracy");
  assert(run.refusal_accuracy === 1, "expected full refusal accuracy");
  assert(run.answer_usability === 1, "expected full answer usability");
  assert(run.results?.length === 20, "expected 20 per-case eval results");

  const detail = await jsonFetch(`/api/evals/runs/${run.id}`);
  assert(detail.run?.id === run.id, "expected detail for created eval run");
  assert(detail.run.total_cases === 20, "expected detail case count");
  assert(detail.run.results?.length === 20, "expected detail results");

  const evalPageResponse = await fetch(`${APP_URL}/admin/evals`);
  const evalPage = await evalPageResponse.text();
  assert(evalPageResponse.ok, "expected eval admin page");
  assert(evalPage.includes("100%"), "expected eval metrics on admin page");

  return {
    id: run.id,
    status: run.status,
    totalCases: run.total_cases,
    citationAccuracy: run.citation_accuracy,
    refusalAccuracy: run.refusal_accuracy,
    answerUsability: run.answer_usability,
  };
});

await runCheck("admin and API surfaces", async () => {
  const paths = [
    "/admin/documents",
    "/admin/conversations",
    "/admin/tickets",
    "/admin/evals",
    "/api/documents",
    "/api/conversations",
    "/api/tickets",
  ];

  const results = [];
  for (const path of paths) {
    const response = await fetch(`${APP_URL}${path}`);
    assert(response.ok, `${path} returned ${response.status}`);
    results.push({ path, status: response.status });
  }

  return results;
});

for (const check of checks) {
  const line = `${check.status} ${check.name} (${check.durationMs}ms)`;
  console.log(line);
  console.log(`  ${JSON.stringify(check.details)}`);
}

const failed = checks.filter((check) => check.status === "FAIL");
if (failed.length) {
  console.error(`\nSmoke test failed: ${failed.length}/${checks.length} checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nSmoke test passed: ${checks.length}/${checks.length} checks passed.`);
}
