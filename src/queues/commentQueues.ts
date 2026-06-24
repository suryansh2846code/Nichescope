import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./redis";

export interface InfluencerDiscoveryJobData {
  username?: string;
  niche?: string;
  testScenario?: string;
  forceAll?: boolean;
}

export interface CommentScrapeJobData {
  postUrl: string;
  niche: string;
}

export interface CommentAnalysisJobData {
  username: string;
  commentText: string;
  postUrl: string;
  niche: string;
}

export const INFLUENCER_DISCOVERY_QUEUE_NAME = "influencer-discovery";
export const INFLUENCER_DISCOVER_JOB_NAME = "discover-influencers";

export const COMMENT_SCRAPE_QUEUE_NAME = "comment-scrape";
export const COMMENT_SCRAPE_JOB_NAME = "scrape-comments";

export const COMMENT_ANALYSIS_QUEUE_NAME = "comment-analysis";
export const COMMENT_ANALYZE_JOB_NAME = "analyze-comment";

const defaultJobOptions = {
  attempts: 2,
  backoff: {
    type: "exponential" as const,
    delay: 5_000,
  },
  timeout: 300_000, // 5 mins
  removeOnComplete: {
    age: 60 * 60 * 24,
    count: 100,
  },
  removeOnFail: {
    age: 60 * 60 * 24 * 7,
  },
};

export const influencerDiscoveryQueue = new Queue<InfluencerDiscoveryJobData, unknown, typeof INFLUENCER_DISCOVER_JOB_NAME>(
  INFLUENCER_DISCOVERY_QUEUE_NAME,
  {
    connection: createRedisConnectionOptions(),
    defaultJobOptions,
  }
);

export const commentScrapeQueue = new Queue<CommentScrapeJobData, unknown, typeof COMMENT_SCRAPE_JOB_NAME>(
  COMMENT_SCRAPE_QUEUE_NAME,
  {
    connection: createRedisConnectionOptions(),
    defaultJobOptions,
  }
);

export const commentAnalysisQueue = new Queue<CommentAnalysisJobData, unknown, typeof COMMENT_ANALYZE_JOB_NAME>(
  COMMENT_ANALYSIS_QUEUE_NAME,
  {
    connection: createRedisConnectionOptions(),
    defaultJobOptions,
  }
);
