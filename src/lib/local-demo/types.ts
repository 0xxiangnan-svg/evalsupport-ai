export type DemoSessionDocumentStatus = "uploaded" | "indexed" | "failed";

export type DemoSessionDocument = {
  id: string;
  filename: string;
  fileType: string;
  status: DemoSessionDocumentStatus;
  chunkCount: number;
  createdAt: string;
  indexedAt: string | null;
};

export type DemoSessionChunk = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  pageNumber: number | null;
  position: number;
};

export type DemoSession = {
  documents: DemoSessionDocument[];
  chunks: DemoSessionChunk[];
};
