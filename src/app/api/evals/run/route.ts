import { NextResponse } from "next/server";

import { hasSupabaseConfig, shouldUseLocalDemo } from "@/lib/config";
import { productionPersistenceUnavailable } from "@/lib/api/production-guard";
import { runLocalDemoEval } from "@/lib/evals/local-demo";
import { localDemoStore } from "@/lib/local-demo/store";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    if (shouldUseLocalDemo()) {
      const run = localDemoStore.createEvalRun(await runLocalDemoEval());

      return NextResponse.json({ run, mode: "local-demo" });
    }

    if (!hasSupabaseConfig()) {
      return productionPersistenceUnavailable();
    }

    const supabase = getSupabaseAdmin();
    const { data: cases, error: casesError } = await supabase
      .from("eval_cases")
      .select("*")
      .order("created_at", { ascending: true });

    if (casesError) {
      throw casesError;
    }

    const results = (cases ?? []).map((item) => ({
      caseId: item.id,
      question: item.question,
      expectedBehavior: item.expected_behavior,
      status: "queued_for_full_eval",
      note: "MVP stores eval cases and run records; full automated scoring is planned for the next milestone.",
    }));

    const totalCases = results.length;
    const { data: run, error: runError } = await supabase
      .from("eval_runs")
      .insert({
        status: "completed",
        total_cases: totalCases,
        citation_accuracy: totalCases ? 0 : null,
        refusal_accuracy: totalCases ? 0 : null,
        answer_usability: totalCases ? 0 : null,
        results,
        notes:
          "MVP placeholder run created. Full question execution and scoring is reserved for the eval milestone.",
      })
      .select("*")
      .single();

    if (runError) {
      throw runError;
    }

    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run evals." },
      { status: 500 },
    );
  }
}
