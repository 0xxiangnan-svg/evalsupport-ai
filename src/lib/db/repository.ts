import { hasSupabaseConfig } from "@/lib/config";
import { formatCustomerSessionLabel } from "@/lib/customer-session";
import { localDemoStore } from "@/lib/local-demo/store";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type DocumentRow = {
  id: string;
  filename: string;
  file_type: string;
  storage_path: string;
  status: string;
  chunk_count: number | null;
  error_message: string | null;
  created_at: string;
  indexed_at: string | null;
};

export type MatchChunkRow = {
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  page_number: number | null;
  position: number | null;
  similarity: number;
};

export async function listDocuments() {
  if (!hasSupabaseConfig()) {
    return localDemoStore.listDocuments();
  }

  const { data, error } = await getSupabaseAdmin()
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as DocumentRow[];
}

export async function listConversations() {
  if (!hasSupabaseConfig()) {
    return localDemoStore.listConversations();
  }

  const { data, error } = await getSupabaseAdmin()
    .from("conversations")
    .select("*, citations(*), customer_sessions(token_hash)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data ?? []).map(addSessionLabel);
}

export async function listTickets() {
  if (!hasSupabaseConfig()) {
    return localDemoStore.listTickets();
  }

  const { data, error } = await getSupabaseAdmin()
    .from("tickets")
    .select("*, conversations(question, answer, status), customer_sessions(token_hash)")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(addSessionLabel);
}

export async function listEvalRuns() {
  if (!hasSupabaseConfig()) {
    return localDemoStore.listEvalRuns();
  }

  const { data, error } = await getSupabaseAdmin()
    .from("eval_runs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

function addSessionLabel<T extends Record<string, unknown>>(row: T) {
  const session = row.customer_sessions as
    | { token_hash?: string | null }
    | null
    | undefined;
  const { customer_sessions: _customerSessions, ...rest } = row;
  void _customerSessions;

  return {
    ...rest,
    session_label: formatCustomerSessionLabel(session?.token_hash),
  };
}
