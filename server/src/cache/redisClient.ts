import Redis from "ioredis";

let client: Redis | null = null;

/** Lazy singleton ioredis client. Tests mock this module entirely. */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
      lazyConnect: true,
    });
  }
  return client;
}

export function resetRedis(): void {
  client = null;
}
