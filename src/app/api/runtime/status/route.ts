import { NextResponse } from "next/server";

import {
  getConfig,
  hasSupabaseConfig,
  isProductionDeployment,
  shouldUseLocalDemo,
} from "@/lib/config";
import { REQUIRED_PRODUCTION_ENV } from "@/lib/api/production-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getConfig();
  const supabaseConfigured = hasSupabaseConfig();
  const production = isProductionDeployment();
  let indexedDocumentCount: number | null = null;

  if (supabaseConfigured) {
    const { count, error } = await getSupabaseAdmin()
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "indexed");

    if (!error) {
      indexedDocumentCount = count ?? 0;
    }
  }

  return NextResponse.json({
    production,
    supabaseConfigured,
    persistent: supabaseConfigured,
    localDemoEnabled: shouldUseLocalDemo(),
    browserDemoAvailable: !supabaseConfigured,
    serverAiConfigured: Boolean(config.OPENAI_API_KEY),
    indexedDocumentCount,
    missingProductionEnv: REQUIRED_PRODUCTION_ENV.filter(
      (name) => !process.env[name],
    ),
    defaultProvider: {
      baseUrl: config.OPENAI_BASE_URL,
      chatModel: config.CHAT_MODEL,
      embeddingProvider: config.EMBEDDING_PROVIDER,
    },
  });
}
