import { Worker } from "bullmq";
import { createRedisConnectionOptions } from "../queues/redis";
import { SCRAPE_QUEUE_NAME, type ScrapeJobData } from "../queues/scrapeQueue";
import { scrapeProfile } from "../scraper/instagram";

const worker = new Worker<ScrapeJobData>(
  SCRAPE_QUEUE_NAME,
  async (job) => {
    console.log(`Starting scrape job ${job.id} for @${job.data.username}`);
    await job.updateProgress(10);

    const profile = await scrapeProfile(job.data.username);
    await job.updateProgress(100);

    console.log(`Finished scrape job ${job.id} for @${job.data.username}`);

    return {
      niche: job.data.niche,
      maxFollowers: job.data.maxFollowers,
      profile,
    };
  },
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  },
);

worker.on("completed", (job) => {
  console.log(`Scrape job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Scrape job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Scrape worker listening on "${SCRAPE_QUEUE_NAME}" queue`);
