import type { DocumentRow, MatchChunkRow } from "@/lib/db/repository";

export type LocalDocumentChunk = {
  id: string;
  document_id: string;
  content: string;
  page_number: number | null;
  position: number;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LocalConversation = {
  id: string;
  question: string;
  answer: string;
  status: string;
  top_similarity: number | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  model: string | null;
  created_at: string;
  citations?: LocalCitation[];
};

export type LocalCitation = {
  id: string;
  conversation_id: string;
  chunk_id: string;
  similarity: number;
  snippet: string;
  label: string;
  created_at: string;
};

export type LocalTicket = {
  id: string;
  conversation_id: string | null;
  question: string;
  trigger_reason: string;
  ai_assessment: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type LocalEvalRun = {
  id: string;
  status: string;
  total_cases: number;
  citation_accuracy: number | null;
  refusal_accuracy: number | null;
  answer_usability: number | null;
  results: unknown[];
  notes: string | null;
  created_at: string;
};

type LocalDocumentInput = {
  filename: string;
  file_type: string;
  storage_path: string;
  metadata: Record<string, unknown>;
};

type LocalChunkInput = {
  document_id: string;
  content: string;
  page_number: number | null;
  position: number;
  embedding: number[];
  metadata: Record<string, unknown>;
};

type LocalConversationInput = {
  question: string;
  answer: string;
  status: string;
  top_similarity: number | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  model: string | null;
};

type LocalDemoStoreState = {
  storage: Map<string, ArrayBuffer>;
  documents: Map<string, DocumentRow>;
  chunks: Map<string, LocalDocumentChunk>;
  conversations: Map<string, LocalConversation>;
  citations: Map<string, LocalCitation>;
  tickets: Map<string, LocalTicket>;
  evalRuns: Map<string, LocalEvalRun>;
};

declare global {
  var __evalsupportLocalDemoStore: LocalDemoStoreState | undefined;
}

const state =
  globalThis.__evalsupportLocalDemoStore ??
  (globalThis.__evalsupportLocalDemoStore = {
    storage: new Map<string, ArrayBuffer>(),
    documents: new Map<string, DocumentRow>(),
    chunks: new Map<string, LocalDocumentChunk>(),
    conversations: new Map<string, LocalConversation>(),
    citations: new Map<string, LocalCitation>(),
    tickets: new Map<string, LocalTicket>(),
    evalRuns: new Map<string, LocalEvalRun>(),
  });

const {
  storage,
  documents,
  chunks,
  conversations,
  citations,
  tickets,
  evalRuns,
} = state;

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function tokenizeSearchText(value: string) {
  const groups = value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokens = new Set<string>();

  for (const group of groups) {
    const chars = Array.from(group);
    if (chars.some((char) => /\p{Script=Han}/u.test(char))) {
      for (const char of chars) {
        tokens.add(char);
      }
      for (let index = 0; index < chars.length - 1; index += 1) {
        tokens.add(`${chars[index]}${chars[index + 1]}`);
      }
    } else if (group.length > 1) {
      tokens.add(group);
    }
  }

  return tokens;
}

export function scoreTextSimilarity(query: string, content: string) {
  const queryTokens = tokenizeSearchText(query);
  if (!queryTokens.size) {
    return 0;
  }

  const contentTokens = tokenizeSearchText(content);
  let overlap = 0;
  for (const token of queryTokens) {
    if (contentTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / queryTokens.size;
}

export const localDemoStore = {
  reset() {
    storage.clear();
    documents.clear();
    chunks.clear();
    conversations.clear();
    citations.clear();
    tickets.clear();
    evalRuns.clear();
  },

  async putFile(path: string, file: File | Blob) {
    storage.set(path, await file.arrayBuffer());
  },

  getFile(path: string) {
    const value = storage.get(path);
    return value ? value.slice(0) : null;
  },

  createDocument(input: LocalDocumentInput) {
    const id = createId("doc");
    const document: DocumentRow = {
      id,
      filename: input.filename,
      file_type: input.file_type,
      storage_path: input.storage_path,
      status: "uploaded",
      chunk_count: 0,
      error_message: null,
      created_at: now(),
      indexed_at: null,
    };
    documents.set(id, document);
    return clone(document);
  },

  listDocuments() {
    return Array.from(documents.values())
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(clone);
  },

  getDocument(id: string) {
    const document = documents.get(id);
    return document ? clone(document) : null;
  },

  updateDocument(id: string, values: Partial<DocumentRow>) {
    const document = documents.get(id);
    if (!document) {
      return null;
    }

    const next = { ...document, ...values };
    documents.set(id, next);
    return clone(next);
  },

  replaceDocumentChunks(documentId: string, inputs: LocalChunkInput[]) {
    for (const [id, chunk] of chunks.entries()) {
      if (chunk.document_id === documentId) {
        chunks.delete(id);
      }
    }

    const inserted = inputs.map((input) => {
      const chunk: LocalDocumentChunk = {
        id: createId("chunk"),
        created_at: now(),
        ...input,
      };
      chunks.set(chunk.id, chunk);
      return clone(chunk);
    });

    return inserted;
  },

  matchChunks(embedding: number[], matchCount: number, minSimilarity: number) {
    const rows: MatchChunkRow[] = Array.from(chunks.values())
      .flatMap((chunk) => {
        const document = documents.get(chunk.document_id);
        if (!document || document.status !== "indexed") {
          return [];
        }

        return [
          {
            chunk_id: chunk.id,
            document_id: document.id,
            document_name: document.filename,
            content: chunk.content,
            page_number: chunk.page_number,
            position: chunk.position,
            similarity: cosineSimilarity(embedding, chunk.embedding),
          } satisfies MatchChunkRow,
        ];
      })
      .filter((row) => row.similarity >= minSimilarity)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, matchCount);

    return rows.map(clone);
  },

  matchChunksByText(query: string, matchCount: number, minSimilarity: number) {
    const rows: MatchChunkRow[] = Array.from(chunks.values())
      .flatMap((chunk) => {
        const document = documents.get(chunk.document_id);
        if (!document || document.status !== "indexed") {
          return [];
        }

        return [
          {
            chunk_id: chunk.id,
            document_id: document.id,
            document_name: document.filename,
            content: chunk.content,
            page_number: chunk.page_number,
            position: chunk.position,
            similarity: scoreTextSimilarity(query, chunk.content),
          } satisfies MatchChunkRow,
        ];
      })
      .filter((row) => row.similarity >= minSimilarity)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, matchCount);

    return rows.map(clone);
  },

  createConversation(input: LocalConversationInput) {
    const conversation: LocalConversation = {
      id: createId("conversation"),
      created_at: now(),
      ...input,
    };
    conversations.set(conversation.id, conversation);
    return clone(conversation);
  },

  createCitations(
    conversationId: string,
    inputs: Array<Pick<LocalCitation, "chunk_id" | "similarity" | "snippet" | "label">>,
  ) {
    const inserted = inputs.map((input) => {
      const citation: LocalCitation = {
        id: createId("citation"),
        conversation_id: conversationId,
        created_at: now(),
        ...input,
      };
      citations.set(citation.id, citation);
      return clone(citation);
    });

    return inserted;
  },

  listConversations() {
    return Array.from(conversations.values())
      .map((conversation) => ({
        ...conversation,
        citations: Array.from(citations.values()).filter(
          (citation) => citation.conversation_id === conversation.id,
        ),
      }))
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(clone);
  },

  createTicket(input: {
    conversation_id: string | null;
    question: string;
    trigger_reason: string;
    ai_assessment: string | null;
  }) {
    const ticket: LocalTicket = {
      id: createId("ticket"),
      status: "open",
      created_at: now(),
      updated_at: now(),
      ...input,
    };
    tickets.set(ticket.id, ticket);
    return clone(ticket);
  },

  updateTicket(id: string, values: Partial<LocalTicket>) {
    const ticket = tickets.get(id);
    if (!ticket) {
      return null;
    }

    const next = { ...ticket, ...values, updated_at: now() };
    tickets.set(id, next);
    return clone(next);
  },

  listTickets() {
    return Array.from(tickets.values())
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(clone);
  },

  createEvalRun(input: Omit<LocalEvalRun, "id" | "created_at">) {
    const run: LocalEvalRun = {
      id: createId("eval"),
      created_at: now(),
      ...input,
    };
    evalRuns.set(run.id, run);
    return clone(run);
  },

  listEvalRuns() {
    return Array.from(evalRuns.values())
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(clone);
  },

  getEvalRun(id: string) {
    const run = evalRuns.get(id);
    return run ? clone(run) : null;
  },
};
