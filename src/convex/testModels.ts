"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

const EXPLABS_BASE_URL = "https://api.experientiallabs.ai/v1";

const MODELS = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "qwen3.8-27b", label: "Qwen 3.8 27B" },
] as const;

async function testModel(
  apiKey: string,
  modelId: string,
  label: string,
): Promise<{ model: string; ok: boolean; reply: string; usage?: Record<string, number>; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${EXPLABS_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: "You are a helpful assistant. Reply in one short sentence." },
          { role: "user", content: "Say hello and confirm which model you are." },
        ],
        temperature: 0.3,
        max_tokens: modelId === "qwen3.8-27b" ? 800 : 200,
      }),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { model: label, ok: false, reply: "", error: `HTTP ${res.status}: ${body.slice(0, 200)}`, latencyMs };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: Record<string, number>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return { model: label, ok: true, reply: content, usage: data.usage, latencyMs };
  } catch (err) {
    return { model: label, ok: false, reply: "", error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}

export const testAllModels = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.EXPLABS_API_KEY;
    if (!apiKey) {
      return { error: "EXPLABS_API_KEY not set in Convex environment. Please add it in Keys / API keys tab." };
    }

    // Test sequentially with delays to avoid rate limits.
    const results = [];
    for (const m of MODELS) {
      let result = await testModel(apiKey, m.id, m.label);
      // Retry once on 429 with a 3-second delay.
      if (!result.ok && result.error?.includes("429")) {
        await new Promise((r) => setTimeout(r, 3000));
        result = await testModel(apiKey, m.id, m.label);
      }
      results.push(result);
      // Small delay between models to avoid throttling.
      await new Promise((r) => setTimeout(r, 1000));
    }

    return {
      keyPresent: true,
      results,
    };
  },
});
