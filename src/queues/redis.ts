import type { RedisOptions } from "ioredis";

export function createRedisConnectionOptions(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn("WARNING: REDIS_URL environment variable is not defined. Falling back to localhost:6379.");
    return {
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }

  try {
    const url = new URL(redisUrl);

    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      db: url.pathname ? Number(url.pathname.replace("/", "")) || 0 : 0,
      maxRetriesPerRequest: null,
    };
  } catch (error) {
    console.error(`ERROR: Failed to parse REDIS_URL. Falling back to localhost:6379. Error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
}
