export type SourceChunk = {
  label: string;
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  similarity: number;
  pageNumber: number | null;
  position: number | null;
};

const citationPattern = /\[S(\d+)\]/g;

export function extractCitationLabels(answer: string) {
  const labels = new Set<string>();
  for (const match of answer.matchAll(citationPattern)) {
    labels.add(`S${match[1]}`);
  }

  return Array.from(labels);
}

export function getValidCitations(answer: string, sources: SourceChunk[]) {
  const sourceByLabel = new Map(sources.map((source) => [source.label, source]));
  return extractCitationLabels(answer)
    .map((label) => sourceByLabel.get(label))
    .filter((source): source is SourceChunk => Boolean(source));
}

export function answerHasValidCitation(answer: string, sources: SourceChunk[]) {
  return getValidCitations(answer, sources).length > 0;
}
