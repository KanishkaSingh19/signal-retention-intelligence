/**
 * rateLimit.js
 * -------------
 * Minimal in-memory rate limiter for the AI endpoints. No external deps.
 *
 * Why this matters: the AI routes call the OpenAI API, which costs money per
 * request against YOUR key. On a public URL, without a limit, someone could
 * hammer the endpoint and run up a bill. This caps requests per IP per
 * window. It's per-process (resets on restart, not shared across instances)
 * -- fine for a portfolio deployment. For real production you'd back this
 * with Redis, but the concept and the protection are the same.
 *
 * This is a defense-in-depth companion to setting a hard spending cap in the
 * OpenAI dashboard (do both).
 */

const WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60_000); // 1 minute
const MAX_REQUESTS = Number(process.env.RATE_MAX || 15); // per IP per window

const hits = new Map(); // ip -> { count, resetAt }

export function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: `Rate limit reached (${MAX_REQUESTS} requests/min). Try again in ${retryAfter}s.`,
    });
  }

  entry.count += 1;
  next();
}

// Occasionally clear stale entries so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits.entries()) {
    if (now > entry.resetAt) hits.delete(ip);
  }
}, WINDOW_MS).unref?.();
