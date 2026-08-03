import OpenAI from "openai";

// This module is SERVER-ONLY. Never import from client components.
// The API key must never be exposed to the browser.

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}

// Primary model for narrative, extraction, planning, and form assist.
// Eligibility decisions are computed deterministically in lib/eligibility/engine.ts,
// so the model is only ever asked for plain-language text / vision extraction.
export const GPT = "gpt-4o" as const;
// Cheaper model for bulk UI translation jobs.
export const GPT_MINI = "gpt-4o-mini" as const;

export type UserContent = string | OpenAI.Chat.ChatCompletionContentPart[];

/** Simple chat completion that returns the assistant text (or ""). */
export async function completeChat(options: {
  model?: string;
  system?: string;
  user: UserContent;
  maxTokens?: number;
}): Promise<string> {
  const openai = getOpenAIClient();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: options.user });

  const response = await openai.chat.completions.create({
    model: options.model ?? GPT,
    max_tokens: options.maxTokens ?? 2000,
    messages,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

export function imagePart(
  mediaType: string,
  base64: string
): OpenAI.Chat.ChatCompletionContentPart {
  return {
    type: "image_url",
    image_url: { url: `data:${mediaType};base64,${base64}` },
  };
}

export function pdfPart(
  filename: string,
  base64: string
): OpenAI.Chat.ChatCompletionContentPart {
  return {
    type: "file",
    file: {
      filename,
      file_data: `data:application/pdf;base64,${base64}`,
    },
  };
}
