import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./redis";

export interface UserIntelligenceJobData {
  username: string;
}

export const USER_INTELLIGENCE_QUEUE_NAME = "user-intelligence";
export const AGGREGATE_USER_JOB_NAME = "aggregate-user";

export const userIntelligenceQueue = new Queue<UserIntelligenceJobData, unknown, typeof AGGREGATE_USER_JOB_NAME>(
  USER_INTELLIGENCE_QUEUE_NAME,
  {
    connection: createRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
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
