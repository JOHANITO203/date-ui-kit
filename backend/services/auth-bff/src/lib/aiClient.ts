import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";

let client: Anthropic | null = null;

const getClient = (): Anthropic | null => {
  if (!env.hasAI) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY as string });
  return client;
};

export const isAiEnabled = (): boolean => env.hasAI;

const extractText = (message: Anthropic.Message): string =>
  message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

/**
 * Single-shot text generation. Short max_tokens; no thinking (these are
 * latency-sensitive micro-tasks). Returns null when AI is not configured.
 */
export const generateText = async (input: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> => {
  const c = getClient();
  if (!c) return null;
  const message = await c.messages.create({
    model: env.AI_MODEL,
    max_tokens: input.maxTokens ?? 1024,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  });
  return extractText(message);
};

/**
 * Structured JSON generation constrained by a JSON schema (Anthropic structured
 * outputs). Returns the parsed object, or null when AI is unavailable / invalid.
 */
export const generateJson = async <T>(input: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T | null> => {
  const c = getClient();
  if (!c) return null;
  const message = await c.messages.create({
    model: env.AI_MODEL,
    max_tokens: input.maxTokens ?? 1024,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
    // Structured outputs: constrain the response to the schema.
    output_config: { format: { type: "json_schema", schema: input.schema } },
  } as Anthropic.MessageCreateParamsNonStreaming);
  const text = extractText(message);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};
