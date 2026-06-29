import { NextResponse } from "next/server";

import { hasSupabaseConfig, shouldUseLocalDemo } from "@/lib/config";
import { productionPersistenceUnavailable } from "@/lib/api/production-guard";
import { localDemoStore } from "@/lib/local-demo/store";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (shouldUseLocalDemo()) {
      const run = localDemoStore.getEvalRun(id);
      if (!run) {
        return NextResponse.json({ error: "Eval run not found." }, { status: 404 });
      }

      return NextResponse.json({ run, mode: "local-demo" });
    }

    if (!hasSupabaseConfig()) {
      return productionPersistenceUnavailable();
    }

    const { data, error } = await getSupabaseAdmin()
      .from("eval_runs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ run: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load eval run." },
      { status: 500 },
    );
  }
}
