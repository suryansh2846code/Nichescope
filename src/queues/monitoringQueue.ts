import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./redis";

export interface MonitoringJobData {
  username: string;
}

export const MONITORING_QUEUE_NAME = "monitoring";
export const CHECK_USER_JOB_NAME = "check-user";

export const monitoringQueue = new Queue<MonitoringJobData, unknown, typeof CHECK_USER_JOB_NAME>(
  MONITORING_QUEUE_NAME,
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
