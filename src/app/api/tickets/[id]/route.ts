import { NextResponse } from "next/server";
import { z } from "zod";

import { hasSupabaseConfig, shouldUseLocalDemo } from "@/lib/config";
import { productionPersistenceUnavailable } from "@/lib/api/production-guard";
import { localDemoStore } from "@/lib/local-demo/store";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const updateTicketSchema = z.object({
  status: z.enum(["open", "resolved", "ignored"]),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = updateTicketSchema.parse(await request.json());

    if (shouldUseLocalDemo()) {
      const ticket = localDemoStore.updateTicket(id, { status: body.status });
      if (!ticket) {
        return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
      }

      return NextResponse.json({ ticket, mode: "local-demo" });
    }

    if (!hasSupabaseConfig()) {
      return productionPersistenceUnavailable();
    }

    const { data, error } = await getSupabaseAdmin()
      .from("tickets")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ticket: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update ticket." },
      { status: 500 },
    );
  }
}
