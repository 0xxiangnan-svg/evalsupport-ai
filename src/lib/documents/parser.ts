import type { SupportedFileType } from "@/lib/documents/file-types";

export type ParsedDocument = {
  text: string;
  metadata: Record<string, unknown>;
};

export async function parseDocumentBuffer(
  buffer: ArrayBuffer,
  fileType: SupportedFileType,
) {
  if (fileType === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Buffer.from(buffer) });
    try {
      const result = await parser.getText();
      return {
        text: result.text,
        metadata: {
          pageCount: result.total,
        },
      } satisfies ParsedDocument;
    } finally {
      await parser.destroy();
    }
  }

  const decoder = new TextDecoder("utf-8");
  return {
    text: decoder.decode(buffer),
    metadata: {
      sourceType: fileType,
    },
  } satisfies ParsedDocument;
}
