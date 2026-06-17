import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { SCRAPE_QUEUE_NAME, type ScrapeJobData } from "../queues/scrapeQueue";
import { scrapeProfile } from "../scraper/instagram";
import { saveOrUpdateScrapedProfile } from "./saveLead";
import { saveOrUpdatePosts } from "./savePost";

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

const worker = new Worker<ScrapeJobData>(
  SCRAPE_QUEUE_NAME,
  async (job) => {
    const username = job.data.username.replace(/^@/, "").trim();
    console.log(`Starting scrape job ${job.id} for @${username}`);
    await job.updateProgress(10);

    try {
      // scrapeProfile returns both profile and posts
      const { profile, posts } = await scrapeProfile(username, {
        onStep: (step) => {
          if (step === 1) console.log("STEP 1: Opening profile");
          if (step === 2) console.log("STEP 2: Extracting profile");
          if (step === 3) console.log("STEP 3: Collecting post urls");
          if (step === 4) console.log("STEP 4: Visiting posts");
        }
      });
      await job.updateProgress(50);

      console.log("STEP 5: Saving profile");
      await saveOrUpdateScrapedProfile(job.data.niche, profile);
      await job.updateProgress(75);

      console.log("STEP 6: Saving posts");
      await saveOrUpdatePosts(username, posts);
      await job.updateProgress(100);

      console.log("STEP 7: Finished");
      console.log(`Finished scrape job ${job.id} for @${username}`);

      return {
        username,
        postsScraped: posts.length,
        status: "success",
        profile,
        niche: job.data.niche,
        maxFollowers: job.data.maxFollowers,
      };
    } catch (error: any) {
      if (error.message === "TIMEOUT") {
        console.log(`Profile timeout reached for @${username}`);
        console.log(`Skipping profile`);
        return {
          username,
          status: "skipped",
          reason: "Timeout",
          postsScraped: 0,
          profile: null,
          niche: job.data.niche,
          maxFollowers: job.data.maxFollowers,
        };
      }
      throw error;
    }
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
