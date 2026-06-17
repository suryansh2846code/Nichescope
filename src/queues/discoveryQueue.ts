import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./redis";

export interface DiscoveryJobData {
  hashtag: string;
}

export const DISCOVERY_QUEUE_NAME = "discovery";
export const DISCOVER_HASHTAG_JOB_NAME = "discover-hashtag";

export const discoveryQueue = new Queue<DiscoveryJobData, unknown, typeof DISCOVER_HASHTAG_JOB_NAME>(
  DISCOVERY_QUEUE_NAME,
  {
    connection: createRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 5_000,
      },
      removeOnComplete: {
        age: 60 * 60 * 24,
        count: 100,
      },
      removeOnFail: {
        age: 60 * 60 * 24 * 7,
      },
    },
  }
);
