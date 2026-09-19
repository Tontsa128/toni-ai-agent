interface Bucket { timestamps: number[]; }

export class RequestRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly windowMs = 60_000, private readonly maxBuckets = 10_000) {
    if (!Number.isInteger(windowMs) || windowMs < 1_000) throw new Error("Invalid rate-limit window.");
    if (!Number.isInteger(maxBuckets) || maxBuckets < 100) throw new Error("Invalid rate-limit bucket limit.");
  }

  consume(key: string, limit: number, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid rate-limit.");
    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    const cutoff = now - this.windowMs;
    bucket.timestamps = bucket.timestamps.filter(timestamp => timestamp > cutoff);
    if (bucket.timestamps.length >= limit) {
      const oldest = bucket.timestamps[0] ?? now;
      return { allowed: false, retryAfterMs: Math.max(1, oldest + this.windowMs - now) };
    }
    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);
    this.prune(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  private prune(now: number): void {
    if (this.buckets.size <= this.maxBuckets) return;
    const cutoff = now - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      bucket.timestamps = bucket.timestamps.filter(timestamp => timestamp > cutoff);
      if (bucket.timestamps.length === 0) this.buckets.delete(key);
      if (this.buckets.size <= this.maxBuckets) break;
    }
  }
}
