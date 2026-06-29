import { NextResponse } from "next/server";

import { getConfig, hasSupabaseConfig, shouldUseLocalDemo } from "@/lib/config";
import { productionPersistenceUnavailable } from "@/lib/api/production-guard";
import {
  assertSupportedFileType,
  sanitizeFilename,
} from "@/lib/documents/file-types";
import { splitIntoChunks } from "@/lib/documents/chunking";
import { parseDocumentBuffer } from "@/lib/documents/parser";
import { localDemoStore } from "@/lib/local-demo/store";
import type { DemoSessionChunk } from "@/lib/local-demo/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field." }, { status: 400 });
    }

    const fileType = assertSupportedFileType(file.name);
    const safeName = sanitizeFilename(file.name);
    const storagePath = `documents/${crypto.randomUUID()}-${safeName}`;

    if (shouldUseLocalDemo()) {
      await localDemoStore.putFile(storagePath, file);
      const document = localDemoStore.createDocument({
        filename: file.name,
        file_type: fileType,
        storage_path: storagePath,
        metadata: {
          size: file.size,
          contentType: file.type,
          mode: "local-demo",
        },
      });

      const parsed = await parseDocumentBuffer(await file.arrayBuffer(), fileType);
      const chunks = splitIntoChunks(parsed.text);
      if (!chunks.length) {
        throw new Error("No indexable text was extracted from this document.");
      }

      const demoChunks: DemoSessionChunk[] = chunks.map((chunk) => ({
        chunkId: `chunk_${crypto.randomUUID()}`,
        documentId: document.id,
        documentName: document.filename,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        position: chunk.position,
      }));

      return NextResponse.json({
        document,
        demoChunks,
        mode: "local-demo",
      });
    }

    if (!hasSupabaseConfig()) {
      return productionPersistenceUnavailable();
    }

    const supabase = getSupabaseAdmin();
    const config = getConfig();

    const { error: uploadError } = await supabase.storage
      .from(config.SUPABASE_STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        filename: file.name,
        file_type: fileType,
        storage_path: storagePath,
        status: "uploaded",
        metadata: {
          size: file.size,
          contentType: file.type,
        },
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ document: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
