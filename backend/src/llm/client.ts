import OpenAI from 'openai';
import { config } from '../config.js';

// The official `openai` SDK speaks the OpenAI wire format, which Groq (and most
// other providers) implement. We just point it at the configured base URL, so
// the same client code works for OpenAI, Groq, or any compatible endpoint.

let chatClient: OpenAI | null = null;
let embeddingClient: OpenAI | null = null;

/** Client for the configured CHAT provider (OpenAI, Groq, …). */
export function getChatClient(): OpenAI {
  const c = config.llm.chat;
  if (!c.enabled) throw new Error('Chat LLM requested but no chat provider is configured.');
  if (!chatClient) chatClient = new OpenAI({ apiKey: c.apiKey, baseURL: c.baseUrl });
  return chatClient;
}

/** Client for the configured EMBEDDING provider. */
export function getEmbeddingClient(): OpenAI {
  const e = config.llm.embeddings;
  if (!e.enabled) throw new Error('Embedding LLM requested but no embedding provider is configured.');
  if (!embeddingClient) embeddingClient = new OpenAI({ apiKey: e.apiKey, baseURL: e.baseUrl });
  return embeddingClient;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Run a chat completion against the configured chat provider. */
export async function chat(
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  const client = getChatClient();
  const res = await client.chat.completions.create({
    model: config.llm.chat.model,
    temperature: opts.temperature ?? 0.2,
    messages,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  });
  return res.choices[0]?.message?.content ?? '';
}
