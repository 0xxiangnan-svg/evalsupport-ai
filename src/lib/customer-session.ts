import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

import { isProductionDeployment } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const CUSTOMER_SESSION_COOKIE = "evalsupport_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type CustomerSession = {
  id: string;
  tokenHash: string;
  label: string;
  setCookieHeader: string | null;
};

type SessionClient = Pick<SupabaseClient, "from">;

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function formatCustomerSessionLabel(tokenHash: string | null | undefined) {
  return tokenHash ? `sess_${tokenHash.slice(0, 6)}` : "-";
}

export async function getOrCreateCustomerSession(
  request: Request,
  supabase: SessionClient = getSupabaseAdmin(),
): Promise<CustomerSession> {
  const existingToken = getCookie(request.headers.get("cookie"), CUSTOMER_SESSION_COOKIE);
  const token = isValidSessionToken(existingToken) ? existingToken : createSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("customer_sessions")
    .upsert(
      {
        token_hash: tokenHash,
        last_seen_at: now,
      },
      { onConflict: "token_hash" },
    )
    .select("id, token_hash")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create customer session.");
  }

  return {
    id: String(data.id),
    tokenHash: String(data.token_hash),
    label: formatCustomerSessionLabel(String(data.token_hash)),
    setCookieHeader:
      token === existingToken ? null : serializeSessionCookie(token, request.url),
  };
}

export function attachCustomerSessionCookie(
  response: NextResponse,
  session: CustomerSession,
) {
  if (session.setCookieHeader) {
    response.headers.append("set-cookie", session.setCookieHeader);
  }

  return response;
}

function isValidSessionToken(value: string | null): value is string {
  return Boolean(value && value.length >= 32 && value.length <= 128);
}

function getCookie(header: string | null, name: string) {
  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

function serializeSessionCookie(token: string, requestUrl: string) {
  const secure =
    isProductionDeployment() || new URL(requestUrl).protocol === "https:";
  const parts = [
    `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
