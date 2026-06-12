import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { SCRAPE_QUEUE_NAME, type ScrapeJobData } from "../queues/scrapeQueue";
import { scrapeProfile } from "../scraper/instagram";
import { saveOrUpdateScrapedProfile } from "./saveLead";

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(`Failed to connect to MongoDB in worker: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const worker = new Worker<ScrapeJobData>(
  SCRAPE_QUEUE_NAME,
  async (job) => {
    console.log(`Starting scrape job ${job.id} for @${job.data.username}`);
    await job.updateProgress(10);

    const profile = await scrapeProfile(job.data.username);
    await job.updateProgress(50);

    await saveOrUpdateScrapedProfile(job.data.niche, profile);

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
