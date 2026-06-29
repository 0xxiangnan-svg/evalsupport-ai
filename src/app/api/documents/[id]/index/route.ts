import { NextResponse } from "next/server";

import { getConfig, hasSupabaseConfig, shouldUseLocalDemo } from "@/lib/config";
import { productionPersistenceUnavailable } from "@/lib/api/production-guard";
import { createLocalEmbedding } from "@/lib/ai/openai-compatible";
import { toPgVector } from "@/lib/db/vector";
import { splitIntoChunks } from "@/lib/documents/chunking";
import { parseDocumentBuffer } from "@/lib/documents/parser";
import { createEmbeddings } from "@/lib/ai/openai-compatible";
import { localDemoStore } from "@/lib/local-demo/store";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (shouldUseLocalDemo()) {
    try {
      const document = localDemoStore.getDocument(id);
      if (!document) {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }

      localDemoStore.updateDocument(id, { status: "indexing", error_message: null });
      const file = localDemoStore.getFile(document.storage_path);
      if (!file) {
        throw new Error("Document file not found in local demo storage.");
      }

      const parsed = await parseDocumentBuffer(file, document.file_type as "pdf" | "md" | "txt");
      const chunks = splitIntoChunks(parsed.text);
      if (!chunks.length) {
        throw new Error("No indexable text was extracted from this document.");
      }

      const embeddings = chunks.map((chunk) => createLocalEmbedding(chunk.content));
      localDemoStore.replaceDocumentChunks(
        id,
        chunks.map((chunk, index) => ({
          document_id: id,
          content: chunk.content,
          page_number: chunk.pageNumber,
          position: chunk.position,
          embedding: embeddings[index],
          metadata: {
            ...parsed.metadata,
            characterLength: chunk.content.length,
            mode: "local-demo",
          },
        })),
      );

      const updated = localDemoStore.updateDocument(id, {
        status: "indexed",
        chunk_count: chunks.length,
        indexed_at: new Date().toISOString(),
      });

      return NextResponse.json({
        document: updated,
        chunkCount: chunks.length,
        mode: "local-demo",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Indexing failed.";
      localDemoStore.updateDocument(id, { status: "failed", error_message: message });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (!hasSupabaseConfig()) {
    return productionPersistenceUnavailable();
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    await supabase
      .from("documents")
      .update({ status: "indexing", error_message: null })
      .eq("id", id);

    const config = getConfig();
    const { data: blob, error: downloadError } = await supabase.storage
      .from(config.SUPABASE_STORAGE_BUCKET)
      .download(document.storage_path);

    if (downloadError || !blob) {
      throw downloadError ?? new Error("Document download failed.");
    }

    const parsed = await parseDocumentBuffer(await blob.arrayBuffer(), document.file_type);
    const chunks = splitIntoChunks(parsed.text);

    if (!chunks.length) {
      throw new Error("No indexable text was extracted from this document.");
    }

    const embeddings = await createEmbeddings(chunks.map((chunk) => chunk.content));

    await supabase.from("document_chunks").delete().eq("document_id", id);

    const { error: insertError } = await supabase.from("document_chunks").insert(
      chunks.map((chunk, index) => ({
        document_id: id,
        content: chunk.content,
        page_number: chunk.pageNumber,
        position: chunk.position,
        embedding: toPgVector(embeddings[index]),
        metadata: {
          ...parsed.metadata,
          characterLength: chunk.content.length,
        },
      })),
    );

    if (insertError) {
      throw insertError;
    }

    const { data: updated, error: updateError } = await supabase
      .from("documents")
      .update({
        status: "indexed",
        chunk_count: chunks.length,
        metadata: parsed.metadata,
        indexed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ document: updated, chunkCount: chunks.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Indexing failed.";
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
