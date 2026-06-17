import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { SCRAPE_QUEUE_NAME, type ScrapeJobData } from "../queues/scrapeQueue";
import { scrapeProfile } from "../scraper/instagram";
import { saveOrUpdateScrapedProfile } from "./saveLead";
import { saveOrUpdatePosts } from "./savePost";
import { setupWorkerLogger } from "../utils/logger";

// Setup logging interceptor
setupWorkerLogger("scraper");

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
    try {
      // scrapeProfile returns both profile and posts
      const { profile, posts } = await scrapeProfile(username, {
        testScenario: job.data.testScenario,
        onStep: async (step) => {
          if (step === 1) {
            console.log("STEP 1: Opening profile");
            await job.updateProgress({ percent: 10, stage: "Opening Profile" });
          }
          if (step === 3) {
            console.log("STEP 3: Collecting post urls");
            await job.updateProgress({ percent: 25, stage: "Loading Posts" });
          }
          if (step === 2) {
            console.log("STEP 2: Extracting profile");
            await job.updateProgress({ percent: 40, stage: "Extracting Profile" });
          }
          if (step === 4) {
            console.log("STEP 4: Visiting posts");
            await job.updateProgress({ percent: 60, stage: "Scraping Posts" });
          }
        }
      });

      await job.updateProgress({ percent: 80, stage: "Saving Data" });

      console.log("STEP 5: Saving profile");
      await saveOrUpdateScrapedProfile(job.data.niche, profile);

      console.log("STEP 6: Saving posts");
      await saveOrUpdatePosts(username, posts);

      await job.updateProgress({ percent: 100, stage: "Completed" });

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
          status: "SKIPPED",
          reason: "TIMEOUT",
          postsScraped: 0,
          profile: null,
          niche: job.data.niche,
          maxFollowers: job.data.maxFollowers,
        };
      }
      if (error.message.startsWith("SKIPPED_LARGE_ACCOUNT:")) {
        const postCount = error.message.split(":")[1];
        console.log(`Skipping @${username}`);
        console.log(`Post count: ${postCount}`);
        return {
          username,
          status: "skipped",
          reason: "SKIPPED_LARGE_ACCOUNT",
          postsScraped: 0,
          profile: null,
          niche: job.data.niche,
          maxFollowers: job.data.maxFollowers,
        };
      }
      if (error.message === "PRIVATE_ACCOUNT") {
        console.log(`Skipping @${username}`);
        console.log(`Private account`);
        return {
          username,
          status: "skipped",
          reason: "Private Account",
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
    concurrency: 5,
  },
);

worker.on("completed", (job) => {
  console.log(`Scrape job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Scrape job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Scrape worker listening on "${SCRAPE_QUEUE_NAME}" queue`);
