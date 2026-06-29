const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000";

const demoChunks = [
  {
    chunkId: "admin_chunk_invoice",
    documentId: "admin_doc_faq",
    documentName: "EvalSupport 企业客服 FAQ.md",
    content:
      "发票规则：年付订单在付款成功后的 1 个工作日内开具电子发票，月付订单在每月账单确认后的 3 个工作日内开具。",
    pageNumber: null,
    position: 0,
  },
];

const checks = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
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

let createdTicketId = null;
let createdConversationId = null;

await runCheck("create fallback ticket through chat", async () => {
  const payload = await jsonFetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: "请告诉我今天北京天气怎么样？",
      demoChunks,
    }),
  });

  assert(payload.status === "ticket_created", "expected ticket_created status");
  assert(payload.ticket?.id, "expected ticket id");
  assert(payload.ticket.triggerReason === "no_citations", "expected no_citations");
  assert(payload.conversationId, "expected conversation id");

  createdTicketId = payload.ticket.id;
  createdConversationId = payload.conversationId;

  return {
    ticketId: createdTicketId,
    conversationId: createdConversationId,
    triggerReason: payload.ticket.triggerReason,
  };
});

await runCheck("ticket appears in admin API", async () => {
  const payload = await jsonFetch("/api/tickets");
  const tickets = payload.tickets ?? payload;
  assert(Array.isArray(tickets), "expected tickets array");
  const ticket = tickets.find((item) => item.id === createdTicketId);
  assert(ticket, "expected created ticket in ticket list");
  assert(ticket.status === "open", "expected new ticket to be open");
  assert(ticket.conversation_id === createdConversationId, "expected linked conversation");

  return {
    count: tickets.length,
    status: ticket.status,
    conversationId: ticket.conversation_id,
  };
});

await runCheck("ticket status can be resolved", async () => {
  const payload = await jsonFetch(`/api/tickets/${createdTicketId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "resolved" }),
  });

  assert(payload.mode === "local-demo", "expected local-demo update");
  assert(payload.ticket?.status === "resolved", "expected resolved ticket");

  const listPayload = await jsonFetch("/api/tickets");
  const tickets = listPayload.tickets ?? listPayload;
  const updated = tickets.find((item) => item.id === createdTicketId);
  assert(updated?.status === "resolved", "expected list to show resolved status");

  return {
    ticketId: createdTicketId,
    status: updated.status,
  };
});

await runCheck("conversation appears without provider key leakage", async () => {
  const payload = await jsonFetch("/api/conversations");
  const conversations = payload.conversations ?? payload;
  assert(Array.isArray(conversations), "expected conversations array");
  const conversation = conversations.find((item) => item.id === createdConversationId);
  assert(conversation, "expected linked conversation in conversation list");
  assert(conversation.status === "ticket_created", "expected ticket_created conversation");
  assert(!JSON.stringify(conversations).includes("mock-browser-key"), "must not expose API key");

  return {
    count: conversations.length,
    conversationStatus: conversation.status,
    exposesApiKey: false,
  };
});

await runCheck("admin pages render after state changes", async () => {
  const paths = ["/admin/conversations", "/admin/tickets", "/admin/documents", "/admin/evals"];
  const results = [];

  for (const path of paths) {
    const response = await fetch(`${APP_URL}${path}`);
    const text = await response.text();
    assert(response.ok, `${path} returned ${response.status}`);
    assert(text.length > 1000, `${path} response was unexpectedly small`);
    results.push({ path, status: response.status, bytes: text.length });
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
  console.error(`\nAdmin regression failed: ${failed.length}/${checks.length} checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAdmin regression passed: ${checks.length}/${checks.length} checks passed.`);
}
