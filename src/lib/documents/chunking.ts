export type TextChunk = {
  content: string;
  position: number;
  pageNumber: number | null;
};

export type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
};

const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_OVERLAP = 150;

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitIntoChunks(text: string, options: ChunkOptions = {}) {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;

  if (chunkSize <= overlap) {
    throw new Error("chunkSize must be larger than overlap.");
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    return [] satisfies TextChunk[];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let position = 0;

  while (start < normalized.length) {
    const hardEnd = Math.min(start + chunkSize, normalized.length);
    let end = hardEnd;

    if (hardEnd < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", hardEnd);
      const sentenceBreak = Math.max(
        normalized.lastIndexOf("。", hardEnd),
        normalized.lastIndexOf(".", hardEnd),
        normalized.lastIndexOf("！", hardEnd),
        normalized.lastIndexOf("？", hardEnd),
      );
      const softBreak = Math.max(paragraphBreak, sentenceBreak);

      if (softBreak > start + chunkSize * 0.55) {
        end = softBreak + 1;
      }
    }

    const content = normalized.slice(start, end).trim();
    if (content) {
      chunks.push({
        content,
        position,
        pageNumber: null,
      });
      position += 1;
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - overlap);
  }

  return chunks;
}
