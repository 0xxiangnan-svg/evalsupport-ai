import { describe, expect, it } from "vitest";

import { splitIntoChunks } from "@/lib/documents/chunking";

describe("splitIntoChunks", () => {
  it("returns empty chunks for blank text", () => {
    expect(splitIntoChunks(" \n\n ")).toEqual([]);
  });

  it("creates stable overlapping chunks", () => {
    const text = Array.from({ length: 80 }, (_, index) => `第${index}句内容。`).join("");
    const chunks = splitIntoChunks(text, { chunkSize: 80, overlap: 15 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].position).toBe(0);
    expect(chunks[1].position).toBe(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(90);
  });

  it("guards invalid options", () => {
    expect(() => splitIntoChunks("hello", { chunkSize: 10, overlap: 10 })).toThrow(
      "chunkSize must be larger than overlap.",
    );
  });
});
