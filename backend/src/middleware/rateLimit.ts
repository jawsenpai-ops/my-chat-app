import type { NextFunction, Request, Response } from "express";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number, now?: number): RateLimitResult;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, WindowEntry>();
  private lastCleanup = 0;

  consume(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
    if (now - this.lastCleanup > 60_000) {
      for (const [entryKey, entry] of this.entries) {
        if (entry.resetAt <= now) this.entries.delete(entryKey);
      }
      this.lastCleanup = now;
    }

    let entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      this.entries.set(key, entry);
    }

    entry.count += 1;
    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
}

export const rateLimitStore: RateLimitStore = new InMemoryRateLimitStore();

type RequestWithUser = Request & { userId?: number };

const getClientKey = (req: RequestWithUser, name: string) => {
  if (typeof req.userId === "number") return `${name}:user:${req.userId}`;
  return `${name}:ip:${req.ip || "unknown"}`;
};

export const createRateLimiter = (options: {
  name: string;
  limit: number;
  windowMs: number;
  message?: string;
}) => {
  const message = options.message || "Too many requests. Please try again later.";

  return (req: Request, res: Response, next: NextFunction) => {
    const result = rateLimitStore.consume(
      getClientKey(req as RequestWithUser, options.name),
      options.limit,
      options.windowMs,
    );

    res.setHeader("RateLimit-Limit", options.limit.toString());
    res.setHeader("RateLimit-Remaining", result.remaining.toString());
    res.setHeader("RateLimit-Reset", Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
      res.setHeader("Retry-After", result.retryAfterSeconds.toString());
      return res.status(429).json({ message });
    }

    return next();
  };
};

export const apiRateLimiter = createRateLimiter({
  name: "api",
  limit: 120,
  windowMs: 60_000,
});

export const loginRateLimiter = createRateLimiter({
  name: "login",
  limit: 10,
  windowMs: 15 * 60_000,
});

export const registerRateLimiter = createRateLimiter({
  name: "register",
  limit: 5,
  windowMs: 60 * 60_000,
});

export const authRateLimiter = createRateLimiter({
  name: "auth",
  limit: 60,
  windowMs: 15 * 60_000,
});

export const messageRateLimiter = createRateLimiter({
  name: "messages",
  limit: 60,
  windowMs: 60_000,
});

export const chatRateLimiter = createRateLimiter({
  name: "chats",
  limit: 60,
  windowMs: 60_000,
});

export const userRateLimiter = createRateLimiter({
  name: "users",
  limit: 60,
  windowMs: 60_000,
});

export const forgotPasswordRateLimiter = createRateLimiter({
  name: "forgot-password",
  limit: 5,
  windowMs: 60 * 60_000,
});

export const resetPasswordRateLimiter = createRateLimiter({
  name: "reset-password",
  limit: 10,
  windowMs: 60 * 60_000,
});

export const resendVerificationRateLimiter = createRateLimiter({
  name: "resend-verification",
  limit: 3,
  windowMs: 60 * 60_000,
});

export const accountActionRateLimiter = createRateLimiter({
  name: "account-actions",
  limit: 10,
  windowMs: 15 * 60_000,
});

export const feedbackRateLimiter = createRateLimiter({
  name: "feedback",
  limit: 5,
  windowMs: 60 * 60_000,
});