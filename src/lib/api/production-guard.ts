import { NextResponse } from "next/server";

export const REQUIRED_PRODUCTION_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "CHAT_MODEL",
  "EMBEDDING_PROVIDER",
] as const;

export function productionPersistenceUnavailable() {
  return NextResponse.json(
    {
      error:
        "Production persistence is not configured. Set Supabase and AI environment variables before using the online service.",
      required: REQUIRED_PRODUCTION_ENV,
    },
    { status: 503 },
  );
}
