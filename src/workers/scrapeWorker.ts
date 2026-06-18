import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { SCRAPE_QUEUE_NAME, type ScrapeJobData, scrapeQueue } from "../queues/scrapeQueue";
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
    
    const startTime = Date.now();
    let currentStage = "Starting";

    const heartbeatInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[HEARTBEAT]\nJob: ${job.id}\nStage: ${currentStage}\nElapsed: ${elapsed}s`);
    }, 10000);

    try {
      // scrapeProfile returns both profile and posts
      const { profile, posts } = await scrapeProfile(username, {
        testScenario: job.data.testScenario,
        onStep: async (step) => {
          if (step === 1) {
            currentStage = "Opening Profile";
            console.log("STEP 1: Opening profile");
            await job.updateProgress({ percent: 10, stage: currentStage });
          }
          if (step === 3) {
            currentStage = "Loading Posts";
            console.log("STEP 3: Collecting post urls");
            await job.updateProgress({ percent: 25, stage: currentStage });
          }
          if (step === 2) {
            currentStage = "Extracting Profile";
            console.log("STEP 2: Extracting profile");
            await job.updateProgress({ percent: 40, stage: currentStage });
          }
          if (step === 4) {
            currentStage = "Scraping Posts";
            console.log("STEP 4: Visiting posts");
            await job.updateProgress({ percent: 60, stage: currentStage });
          }
        }
      });

      currentStage = "Saving Data";
      await job.updateProgress({ percent: 80, stage: currentStage });

      console.log("STEP 5: Saving profile");
      await saveOrUpdateScrapedProfile(job.data.niche, profile);

      console.log("STEP 6: Saving posts");
      await saveOrUpdatePosts(username, posts);

      currentStage = "Completed";
      await job.updateProgress({ percent: 100, stage: currentStage });

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
      if (error.message === "NO_POSTS_FOUND") {
        console.warn(`[SKIPPED] No post URLs discovered for @${username}`);
        return {
          username,
          status: "SKIPPED",
          reason: "NO_POSTS_FOUND",
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
    } finally {
      clearInterval(heartbeatInterval);
    }
  },
  {
    connection: createRedisConnectionOptions(),
    concurrency: 5,
  },
);

worker.on("completed", (job) => {
  const username = job.data?.username || "unknown";
  console.log(`[COMPLETED] Job ID: ${job.id}, Username: @${username}`);
});

worker.on("failed", (job, error) => {
  const username = job?.data?.username || "unknown";
  console.error(`[FAILED] Job ID: ${job?.id ?? "unknown"}, Username: @${username}, Error: ${error.message}`);
});

worker.on("stalled", async (jobId) => {
  try {
    const job = await scrapeQueue.getJob(jobId);
    const username = job?.data?.username || "unknown";
    console.log(`[STALLED] Job ID: ${jobId}, Username: @${username}`);
  } catch (err) {
    console.log(`[STALLED] Job ID: ${jobId}`);
  }
});

console.log(`Scrape worker listening on "${SCRAPE_QUEUE_NAME}" queue`);
