import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./redis";

export interface AnalysisJobData {
  postId: string;
  username: string;
  caption: string;
}

export const ANALYSIS_QUEUE_NAME = "analysis";
export const ANALYZE_POST_JOB_NAME = "analyze-post";

export const analysisQueue = new Queue<AnalysisJobData, unknown, typeof ANALYZE_POST_JOB_NAME>(
  ANALYSIS_QUEUE_NAME,
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
