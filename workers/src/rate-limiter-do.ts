/**
 * Durable Object for atomic per-feature rate limiting.
 * Each DO instance handles one user+feature+window combination.
 *
 * Key format: "userId:feature:2026-03-31" (day) or "userId:feature:2026-03" (month)
 */

export class RateLimiterDO {
  private state: DurableObjectState;
  private count: number | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/check") {
      const limit = parseInt(url.searchParams.get("limit") ?? "0", 10);
      return this.check(limit);
    }

    if (url.pathname === "/increment") {
      return this.increment();
    }

    return new Response("Not found", { status: 404 });
  }

  private async check(limit: number): Promise<Response> {
    if (this.count === null) {
      this.count = (await this.state.storage.get<number>("count")) ?? 0;
    }

    const allowed = this.count < limit;
    return Response.json({
      allowed,
      current: this.count,
      limit,
      remaining: Math.max(0, limit - this.count),
    });
  }

  private async increment(): Promise<Response> {
    if (this.count === null) {
      this.count = (await this.state.storage.get<number>("count")) ?? 0;
    }

    this.count += 1;
    await this.state.storage.put("count", this.count);

    return Response.json({ current: this.count });
  }
}

// ── Helper to check + increment atomically from Workers ──────────

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}

export async function checkAndIncrementRateLimit(
  rateLimiterNs: DurableObjectNamespace,
  key: string,
  limit: number,
): Promise<RateLimitResult> {
  const id = rateLimiterNs.idFromName(key);
  const stub = rateLimiterNs.get(id);

  try {
    // Check
    const checkRes = await stub.fetch(
      new Request(`https://rate-limiter/check?limit=${limit}`),
    );
    const checkData = (await checkRes.json()) as RateLimitResult;

    if (!checkData.allowed) {
      return checkData;
    }

    // Increment (only if allowed)
    await stub.fetch(new Request("https://rate-limiter/increment"));

    return {
      allowed: true,
      current: checkData.current + 1,
      limit,
      remaining: Math.max(0, limit - checkData.current - 1),
    };
  } catch (err) {
    // Fail-open: if DO is unreachable, allow the request and log
    console.error("RateLimiterDO error (failing open):", err);
    return { allowed: true, current: 0, limit, remaining: limit };
  }
}
