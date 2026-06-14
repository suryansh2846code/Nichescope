import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./redis";

export interface MarketIntelligenceJobData {
  timestamp: string;
}

export const MARKET_INTELLIGENCE_QUEUE_NAME = "market-intelligence";
export const AGGREGATE_MARKET_JOB_NAME = "aggregate-market";

export const marketIntelligenceQueue = new Queue<MarketIntelligenceJobData, unknown, typeof AGGREGATE_MARKET_JOB_NAME>(
  MARKET_INTELLIGENCE_QUEUE_NAME,
  {
    connection: createRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10_000,
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
