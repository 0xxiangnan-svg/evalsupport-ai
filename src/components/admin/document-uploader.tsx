"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDemoUpload } from "@/lib/local-demo/session";
import type { DemoSessionChunk } from "@/lib/local-demo/types";

type UploadPayload = {
  document: {
    id: string;
    filename: string;
    file_type: string;
    status: string;
    chunk_count?: number | null;
    created_at: string;
    indexed_at?: string | null;
  };
  demoChunks?: DemoSessionChunk[];
  mode?: string;
  error?: string;
};

export function DocumentUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function uploadDocument() {
    if (!file) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "上传失败");
      }
      if (payload.mode === "local-demo" && payload.demoChunks) {
        saveDemoUpload({
          document: payload.document,
          chunks: payload.demoChunks,
        });
        setMessage("已保存到本地 Demo");
      }
      setFile(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "上传失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        type="file"
        accept=".pdf,.md,.txt"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Button
        onClick={() => void uploadDocument()}
        disabled={!file || isLoading}
        className="sm:w-32"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        上传
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
