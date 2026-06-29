import { describe, expect, it } from "vitest";

import {
  assertSupportedFileType,
  getFileExtension,
  isSupportedFileType,
  sanitizeFilename,
} from "@/lib/documents/file-types";

describe("file type helpers", () => {
  it("accepts pdf, markdown, and txt files", () => {
    expect(isSupportedFileType("policy.pdf")).toBe(true);
    expect(isSupportedFileType("faq.MD")).toBe(true);
    expect(isSupportedFileType("notes.txt")).toBe(true);
  });

  it("rejects unsupported files", () => {
    expect(isSupportedFileType("archive.zip")).toBe(false);
    expect(() => assertSupportedFileType("archive.zip")).toThrow(
      "Only .pdf, .md, and .txt documents are supported.",
    );
  });

  it("extracts extensions and sanitizes names", () => {
    expect(getFileExtension("客服 政策.pdf")).toBe("pdf");
    expect(sanitizeFilename("客服 政策 !!.pdf")).toBe("客服-政策-.pdf");
  });
});
