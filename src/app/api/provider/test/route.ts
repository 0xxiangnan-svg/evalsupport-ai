import { NextResponse } from "next/server";
import { z } from "zod";

import { createChatCompletionWithProviderConfig } from "@/lib/ai/openai-compatible";
import { parseProviderConfig, redactSensitiveText } from "@/lib/ai/provider-config";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  providerConfig: z.unknown(),
});

export async function POST(request: Request) {
  let apiKeyForRedaction: string | undefined;

  try {
    const { providerConfig: rawProviderConfig } = requestSchema.parse(
      await request.json(),
    );
    const providerConfig = parseProviderConfig(rawProviderConfig);
    apiKeyForRedaction = providerConfig.apiKey;
    const result = await createChatCompletionWithProviderConfig(
      [
        {
          role: "system",
          content: "Reply with OK only.",
        },
        {
          role: "user",
          content: "ping",
        },
      ],
      providerConfig,
    );

    return NextResponse.json({
      ok: true,
      model: result.model,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? redactSensitiveText(error.message, apiKeyForRedaction)
        : "Provider test failed.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
