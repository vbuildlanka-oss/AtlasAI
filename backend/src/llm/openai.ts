import OpenAI from 'openai';
import { config } from '../config.js';

let client: OpenAI | null = null;

/** Lazily construct a shared OpenAI client. Only called when a key is present. */
export function getOpenAI(): OpenAI {
  if (!config.openai.apiKey) {
    throw new Error('OpenAI client requested but OPENAI_API_KEY is not set.');
  }
  if (!client) {
    client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return client;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Run a chat completion. JSON mode is optional but strongly recommended for agents. */
export async function chat(
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model: config.openai.chatModel,
    temperature: opts.temperature ?? 0.2,
    messages,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  });
  return res.choices[0]?.message?.content ?? '';
}
