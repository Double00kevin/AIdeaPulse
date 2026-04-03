/**
 * GET /api/ai-test — Workers AI test endpoint (Phase 2B)
 *
 * Test different Workers AI models for comparison against Claude.
 * Supports text generation, summarization, and embeddings.
 *
 * Query params:
 *   ?task=generate|summarize|embed
 *   &prompt=your text here
 *   &model=optional model override
 */

import { Hono } from "hono";
import type { Env } from "../index";

const aiTestHandler = new Hono<{ Bindings: Env }>();

const DEFAULT_MODELS: Record<string, string> = {
  generate: "@cf/meta/llama-4-scout-17b-16e-instruct",
  summarize: "@cf/meta/llama-4-scout-17b-16e-instruct",
  embed: "@cf/baai/bge-m3",
};

aiTestHandler.get("/", async (c) => {
  const task = c.req.query("task") ?? "generate";
  const prompt = c.req.query("prompt") ?? "What is Cloudflare Workers AI?";
  const model = c.req.query("model") ?? DEFAULT_MODELS[task];

  if (!model) {
    return c.json({ error: `Unknown task: ${task}. Use generate, summarize, or embed.` }, 400);
  }

  const start = Date.now();

  try {
    if (task === "embed") {
      const result = await c.env.AI.run(model as BaseAiTextEmbeddingsModels, {
        text: [prompt],
      });
      const elapsed = Date.now() - start;
      return c.json({
        task,
        model,
        elapsed_ms: elapsed,
        dimensions: result.data?.[0]?.length ?? 0,
        sample: result.data?.[0]?.slice(0, 5),
      });
    }

    // Text generation / summarization
    const systemPrompt =
      task === "summarize"
        ? "Summarize the following text concisely."
        : "You are a helpful assistant.";

    const result = await c.env.AI.run(model as BaseAiTextGenerationModels, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      max_tokens: 512,
    });

    const elapsed = Date.now() - start;
    return c.json({
      task,
      model,
      elapsed_ms: elapsed,
      response: result.response ?? result,
    });
  } catch (e) {
    const elapsed = Date.now() - start;
    return c.json(
      {
        task,
        model,
        elapsed_ms: elapsed,
        error: e instanceof Error ? e.message : String(e),
      },
      500,
    );
  }
});

export { aiTestHandler };
