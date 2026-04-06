type RateLimitBucket = {
  count: number;
  windowStartMs: number;
};

export type RateLimitOptions = {
  windowMs: number;
  max: number;
};

const buckets = new Map<string, RateLimitBucket>();

export const consumeRateLimit = (key: string, options: RateLimitOptions) => {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.windowStartMs >= options.windowMs) {
    buckets.set(key, {
      count: 1,
      windowStartMs: now,
    });
    return { allowed: true, remaining: options.max - 1 };
  }

  const nextCount = current.count + 1;
  current.count = nextCount;
  buckets.set(key, current);

  return {
    allowed: nextCount <= options.max,
    remaining: Math.max(0, options.max - nextCount),
  };
};

