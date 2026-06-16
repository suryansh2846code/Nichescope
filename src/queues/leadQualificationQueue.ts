import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./redis";

export interface LeadQualificationJobData {
  username: string;
}

export const LEAD_QUALIFICATION_QUEUE_NAME = "lead-qualification";
export const QUALIFY_LEAD_JOB_NAME = "qualify-lead";

export const leadQualificationQueue = new Queue<LeadQualificationJobData, unknown, typeof QUALIFY_LEAD_JOB_NAME>(
  LEAD_QUALIFICATION_QUEUE_NAME,
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
