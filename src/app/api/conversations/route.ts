import { NextResponse } from "next/server";

import { hasSupabaseConfig, isProductionDeployment } from "@/lib/config";
import { productionPersistenceUnavailable } from "@/lib/api/production-guard";
import { listConversations } from "@/lib/db/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isProductionDeployment() && !hasSupabaseConfig()) {
      return productionPersistenceUnavailable();
    }

    return NextResponse.json({ conversations: await listConversations() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load conversations." },
      { status: 500 },
    );
  }
}
