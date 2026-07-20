/**
 * openaiClient.js
 * ----------------
 * Thin wrapper around the OpenAI SDK so the rest of the app doesn't repeat
 * config. Defaults to gpt-4o-mini (cheap, fast, more than capable for
 * text-to-SQL and short generation). Override with OPENAI_MODEL in .env.
 */

import OpenAI from "openai";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

let _client = null;
function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set on the server. Add it to backend/.env to enable the AI features."
    );
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

/**
 * Plain chat completion -> returns the assistant's text.
 */
export async function chat(messages, { temperature = 0.4, maxTokens = 500 } = {}) {
  const resp = await client().chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Chat completion with tools -> returns the full message object so the
 * caller can inspect tool_calls. Used by the text-to-SQL agent loop.
 */
export async function chatWithTools(messages, tools, { temperature = 0.1, maxTokens = 700 } = {}) {
  const resp = await client().chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    tools,
    tool_choice: "auto",
    temperature,
    max_tokens: maxTokens,
  });
  return resp.choices[0]?.message ?? null;
}

export { OPENAI_MODEL };
