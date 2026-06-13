import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";

// Provider-pluggable AI helpers. The selected provider (env.AI_PROVIDER) is used
// for every call; both are fully wired so flipping the env var is all it takes.

let anthropicClient: Anthropic | null = null;
const getAnthropic = (): Anthropic | null => {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return anthropicClient;
};

export const isAiEnabled = (): boolean => env.hasAI;

const extractAnthropicText = (message: Anthropic.Message): string =>
  message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

// ── DeepSeek (OpenAI-compatible Chat Completions) ───────────────────────────
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const deepseekChat = async (input: {
  messages: ChatMessage[];
  maxTokens: number;
  jsonMode?: boolean;
}): Promise<string | null> => {
  if (!env.DEEPSEEK_API_KEY) return null;
  try {
    const res = await fetch(`${env.DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL,
        messages: input.messages,
        max_tokens: input.maxTokens,
        ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
};

/** Single-shot text generation via the configured provider. */
export const generateText = async (input: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> => {
  if (!env.hasAI) return null;
  const maxTokens = input.maxTokens ?? 1024;

  if (env.AI_PROVIDER === "deepseek") {
    return deepseekChat({
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
      maxTokens,
    });
  }

  const c = getAnthropic();
  if (!c) return null;
  const message = await c.messages.create({
    model: env.AI_MODEL,
    max_tokens: maxTokens,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  });
  return extractAnthropicText(message);
};

/** Structured JSON generation via the configured provider. */
export const generateJson = async <T>(input: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T | null> => {
  if (!env.hasAI) return null;
  const maxTokens = input.maxTokens ?? 1024;

  let text: string | null;
  if (env.AI_PROVIDER === "deepseek") {
    // DeepSeek json_object mode doesn't enforce a schema, so describe it inline.
    text = await deepseekChat({
      messages: [
        {
          role: "system",
          content: `${input.system}\n\nRespond ONLY with a JSON object matching this JSON Schema:\n${JSON.stringify(
            input.schema,
          )}`,
        },
        { role: "user", content: input.prompt },
      ],
      maxTokens,
      jsonMode: true,
    });
  } else {
    const c = getAnthropic();
    if (!c) return null;
    const message = await c.messages.create({
      model: env.AI_MODEL,
      max_tokens: maxTokens,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
      // Anthropic structured outputs: constrain the response to the schema.
      output_config: { format: { type: "json_schema", schema: input.schema } },
    } as Anthropic.MessageCreateParamsNonStreaming);
    text = extractAnthropicText(message);
  }

  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};
