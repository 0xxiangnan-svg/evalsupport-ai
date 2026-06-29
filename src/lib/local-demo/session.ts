import type {
  DemoSession,
  DemoSessionChunk,
  DemoSessionDocument,
} from "@/lib/local-demo/types";

const STORAGE_KEY = "evalsupport-ai.local-demo-session.v1";
const SESSION_EVENT = "evalsupport-ai-local-demo-session";
const SAMPLE_DOCUMENT_ID = "demo_doc_evalsupport_faq";

export const SAMPLE_DEMO_CHUNKS: DemoSessionChunk[] = [
  {
    chunkId: "demo_chunk_invoice",
    documentId: SAMPLE_DOCUMENT_ID,
    documentName: "EvalSupport 企业客服 FAQ.md",
    content:
      "发票规则：年付订单在付款成功后的 1 个工作日内开具电子发票，月付订单在每月账单确认后的 3 个工作日内开具。用户可以在后台的账单中心下载发票，如需修改抬头必须在开票前提交。",
    pageNumber: null,
    position: 0,
  },
  {
    chunkId: "demo_chunk_trial",
    documentId: SAMPLE_DOCUMENT_ID,
    documentName: "EvalSupport 企业客服 FAQ.md",
    content:
      "试用政策：标准版提供 14 天试用期，企业版可以申请 30 天试用。试用期包含知识库上传、RAG 问答、来源引用和工单兜底能力，但默认限制为 3 个管理员席位。",
    pageNumber: null,
    position: 1,
  },
  {
    chunkId: "demo_chunk_ticket",
    documentId: SAMPLE_DOCUMENT_ID,
    documentName: "EvalSupport 企业客服 FAQ.md",
    content:
      "工单兜底：当检索 Top 1 相似度低于阈值、没有可引用 chunk、模型回答缺少来源标签，或者问题明显超出知识库范围时，系统不会强行回答，会创建待处理工单并记录触发原因。",
    pageNumber: null,
    position: 2,
  },
  {
    chunkId: "demo_chunk_security",
    documentId: SAMPLE_DOCUMENT_ID,
    documentName: "EvalSupport 企业客服 FAQ.md",
    content:
      "安全说明：用户自带 API Key 只保存在浏览器 localStorage 中，对话时随请求发送到服务端代理调用模型。系统不会把用户 API Key 写入数据库、会话记录、工单或日志。",
    pageNumber: null,
    position: 3,
  },
];

const emptySession: DemoSession = {
  documents: [],
  chunks: [],
};
let cachedRaw: string | null = null;
let cachedSession: DemoSession = emptySession;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function emitSessionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
}

export function subscribeDemoSession(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function loadDemoSession(): DemoSession {
  if (!canUseStorage()) {
    return emptySession;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    cachedRaw = null;
    cachedSession = emptySession;
    return emptySession;
  }

  if (raw === cachedRaw) {
    return cachedSession;
  }

  try {
    const parsed = JSON.parse(raw) as DemoSession;
    cachedRaw = raw;
    cachedSession = {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
    };
    return cachedSession;
  } catch {
    cachedRaw = null;
    cachedSession = emptySession;
    return emptySession;
  }
}

export function saveDemoSession(session: DemoSession) {
  if (!canUseStorage()) {
    return;
  }

  const raw = JSON.stringify(session);
  cachedRaw = raw;
  cachedSession = session;
  window.localStorage.setItem(STORAGE_KEY, raw);
  emitSessionChanged();
}

export function saveDemoUpload(input: {
  document: {
    id: string;
    filename: string;
    file_type: string;
    status: string;
    chunk_count?: number | null;
    created_at: string;
    indexed_at?: string | null;
  };
  chunks: DemoSessionChunk[];
}) {
  const current = loadDemoSession();
  const document: DemoSessionDocument = {
    id: input.document.id,
    filename: input.document.filename,
    fileType: input.document.file_type,
    status: "uploaded",
    chunkCount: input.chunks.length,
    createdAt: input.document.created_at,
    indexedAt: null,
  };

  saveDemoSession({
    documents: [
      document,
      ...current.documents.filter((item) => item.id !== document.id),
    ].slice(0, 20),
    chunks: [
      ...current.chunks.filter((chunk) => chunk.documentId !== document.id),
      ...input.chunks,
    ].slice(-120),
  });
}

export function markDemoDocumentIndexed(documentId: string) {
  const current = loadDemoSession();
  const indexedAt = new Date().toISOString();
  const documentChunks = current.chunks.filter(
    (chunk) => chunk.documentId === documentId,
  );

  saveDemoSession({
    ...current,
    documents: current.documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            status: "indexed",
            chunkCount: documentChunks.length,
            indexedAt,
          }
        : document,
    ),
  });
}

export function clearDemoSession() {
  if (!canUseStorage()) {
    return;
  }

  cachedRaw = null;
  cachedSession = emptySession;
  window.localStorage.removeItem(STORAGE_KEY);
  emitSessionChanged();
}

export function getIndexedDemoChunks() {
  const current = loadDemoSession();
  const indexedDocumentIds = new Set(
    current.documents
      .filter((document) => document.status === "indexed")
      .map((document) => document.id),
  );

  return current.chunks.filter((chunk) =>
    indexedDocumentIds.has(chunk.documentId),
  );
}

export function seedSampleDemoSession() {
  const current = loadDemoSession();
  const now = new Date().toISOString();
  const sampleDocument: DemoSessionDocument = {
    id: SAMPLE_DOCUMENT_ID,
    filename: "EvalSupport 企业客服 FAQ.md",
    fileType: "md",
    status: "indexed",
    chunkCount: SAMPLE_DEMO_CHUNKS.length,
    createdAt: now,
    indexedAt: now,
  };

  saveDemoSession({
    documents: [
      sampleDocument,
      ...current.documents.filter((item) => item.id !== SAMPLE_DOCUMENT_ID),
    ].slice(0, 20),
    chunks: [
      ...current.chunks.filter((chunk) => chunk.documentId !== SAMPLE_DOCUMENT_ID),
      ...SAMPLE_DEMO_CHUNKS,
    ].slice(-120),
  });

  return SAMPLE_DEMO_CHUNKS;
}

export function getSampleDemoChunkCount() {
  return SAMPLE_DEMO_CHUNKS.length;
}
