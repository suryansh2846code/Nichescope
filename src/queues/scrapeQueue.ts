import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./redis";

export interface ScrapeJobData {
  username: string;
  niche: string;
  maxFollowers?: number;
  testScenario?: string;
}

export const SCRAPE_QUEUE_NAME = "scrape";
export const SCRAPE_PROFILE_JOB_NAME = "scrape-profile";

export const scrapeQueue = new Queue<ScrapeJobData, unknown, typeof SCRAPE_PROFILE_JOB_NAME>(SCRAPE_QUEUE_NAME, {
  connection: createRedisConnectionOptions(),
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
    // Kill the job at BullMQ level if it exceeds 90s — the worker's internal
    // 60s guard should fire first, but this is a safety net for stalls/hangs.
    timeout: 90_000,
    removeOnComplete: {
      age: 60 * 60 * 24,
      count: 100,
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 7,
    },
  },
});