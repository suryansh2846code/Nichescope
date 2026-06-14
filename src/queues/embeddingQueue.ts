import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./redis";

export interface EmbeddingJobData {
  postId: string;
  username: string;
}

export const EMBEDDING_QUEUE_NAME = "embedding";
export const GENERATE_EMBEDDING_JOB_NAME = "generate-embedding";

export const embeddingQueue = new Queue<EmbeddingJobData, unknown, typeof GENERATE_EMBEDDING_JOB_NAME>(
  EMBEDDING_QUEUE_NAME,
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
