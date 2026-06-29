export const SUPPORTED_FILE_TYPES = ["pdf", "md", "txt"] as const;

export type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number];

export function getFileExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase().trim();
  return extension || "";
}

export function isSupportedFileType(filename: string) {
  return SUPPORTED_FILE_TYPES.includes(
    getFileExtension(filename) as SupportedFileType,
  );
}

export function assertSupportedFileType(filename: string): SupportedFileType {
  const extension = getFileExtension(filename);
  if (!SUPPORTED_FILE_TYPES.includes(extension as SupportedFileType)) {
    throw new Error("Only .pdf, .md, and .txt documents are supported.");
  }

  return extension as SupportedFileType;
}

export function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-\u4e00-\u9fa5]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
