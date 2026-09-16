import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError, type ModelMessage } from "ai";
import type { z } from "zod";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export const COBRAND_MODEL = "openai/gpt-6-astra";

function createRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      const response = await fetch(input, { ...init, headers });
      const next = response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim();
      if (!runId && next) runId = next;
      return response;
    },
  };
}

function getProvider() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this project yet.");
  const runIdFetch = createRunIdFetch();
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch as typeof fetch,
  });
}

export type AgentFile = {
  mediaType: string;
  /** base64 encoded bytes */
  data: string;
  filename?: string;
};

export type AgentEffort = "low" | "medium" | "high";

type UserPart =
  | { type: "text"; text: string }
  | { type: "file"; data: string; mediaType: string; filename?: string };

/**
 * Runs one discrete agent step against Lovable AI and returns typed JSON.
 * Always streams (reasoning models can run for minutes) but is consumed
 * server-side, so callers get a plain one-shot result.
 */
export async function runAgent<T>(options: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  files?: AgentFile[];
  effort?: AgentEffort;
  fallback?: T;
}): Promise<T> {
  const provider = getProvider();

  const parts: UserPart[] = [{ type: "text", text: options.prompt }];
  for (const file of options.files ?? []) {
    parts.push({
      type: "file",
      data: file.data,
      mediaType: file.mediaType,
      ...(file.filename ? { filename: file.filename } : {}),
    });
  }

  const messages: ModelMessage[] = [{ role: "user", content: parts as never }];

  try {
    const result = streamText({
      model: provider.responses(COBRAND_MODEL),
      system: options.system,
      messages,
      output: Output.object({ schema: options.schema as never }),
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: options.effort ?? "medium",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    // Drain the stream server-side; bytes keep flowing so the call survives.
    const output = (await result.output) as T;
    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const salvaged = salvageJson<T>(error.text);
      if (salvaged) return salvaged;
      if (options.fallback !== undefined) return options.fallback;
    }
    throw normalizeGatewayError(error);
  }
}

function salvageJson<T>(text: string | undefined): T | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export function normalizeGatewayError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("402") || message.toLowerCase().includes("credit")) {
    return new Error(
      "The workspace is out of AI credits. Add credits in Lovable to keep analysing brand material.",
    );
  }
  if (message.includes("429")) {
    return new Error("AI is busy right now. Wait a few seconds and try again.");
  }
  if (message.includes("403")) {
    return new Error("AI access is blocked for this workspace. Check the workspace AI settings.");
  }
  return new Error(message);
}
