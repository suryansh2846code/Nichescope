import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { DISCOVERY_QUEUE_NAME, type DiscoveryJobData } from "../queues/discoveryQueue";
import { scrapeHashtag } from "../scraper/instagram";
import { Lead } from "../models/Lead";
import { HashtagDiscovery } from "../models/HashtagDiscovery";
import { scrapeQueue, SCRAPE_PROFILE_JOB_NAME } from "../queues/scrapeQueue";
import { setupWorkerLogger } from "../utils/logger";

// Setup logging interceptor
setupWorkerLogger("discovery");

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in discovery worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

const worker = new Worker<DiscoveryJobData>(
  DISCOVERY_QUEUE_NAME,
  async (job) => {
    console.log("[WORKER RECEIVED]", job.data);
    const rawHashtag = job.data.hashtag;
    const keywords = rawHashtag
      .split(/[\s,+#]+/)
      .map((k: string) => k.trim().toLowerCase())
      .filter(Boolean);

    if (keywords.length === 0) {
      throw new Error("No valid keywords found");
    }

    console.log(`Starting hashtag discovery job ${job.id} for keywords: ${keywords.join(", ")}`);

    let enqueuedCount = 0;
    let skippedCount = 0;

    const keywordWeight = 100 / keywords.length;

    for (let kIdx = 0; kIdx < keywords.length; kIdx++) {
      const cleanHashtag = keywords[kIdx]!;
      console.log(`[Keyword ${kIdx + 1}/${keywords.length}] Scraping #${cleanHashtag}`);

      const progressBase = kIdx * keywordWeight;

      // Update progress: starting scraping
      await job.updateProgress({
        percent: Math.floor(progressBase + keywordWeight * 0.1),
        currentKeyword: cleanHashtag,
        added: enqueuedCount,
        skipped: skippedCount,
        currentIndex: 0,
        totalCount: 0,
      });

      const result = await scrapeHashtag(cleanHashtag, { maxPosts: 50 });

      // Update progress: finished scraping, starting processing
      await job.updateProgress({
        percent: Math.floor(progressBase + keywordWeight * 0.5),
        currentKeyword: cleanHashtag,
        added: enqueuedCount,
        skipped: skippedCount,
        currentIndex: 0,
        totalCount: result.discoveries.length,
      });

      let current = 0;
      const total = result.discoveries.length;

      for (const discovery of result.discoveries) {
        try {
          const username = discovery.username.toLowerCase();

          // 1. Check if user already exists in the leads collection
          const leadExists = await Lead.exists({
            username: new RegExp(`^${username}$`, "i"),
          });

          if (leadExists) {
            skippedCount++;
            current++;
            continue;
          }

          // 2. Check if user already exists in the discoveries collection
          const discoveryExists = await HashtagDiscovery.exists({
            username: new RegExp(`^${username}$`, "i"),
          });

          if (discoveryExists) {
            skippedCount++;
            current++;
            continue;
          }

          console.log("[DISCOVERY SAVE]", {
            hashtag: cleanHashtag,
            username: username
          });

          // 3. Save to HashtagDiscovery DB collection
          await HashtagDiscovery.create({
            hashtag: cleanHashtag,
            username: username,
            sourcePostUrl: discovery.sourcePostUrl,
            discoveredAt: new Date(),
          });

          // 4. Enqueue into scrapeQueue
          const scrapeJobId = `scrape-${username}-${Date.now()}`;
          await scrapeQueue.add(
            SCRAPE_PROFILE_JOB_NAME,
            {
              username: username,
              niche: cleanHashtag,
            },
            { jobId: scrapeJobId }
          );

          enqueuedCount++;
        } catch (err) {
          console.error(
            `Error enqueuing discovered username "${discovery.username}":`,
            err instanceof Error ? err.message : String(err)
          );
        }

        current++;

        // Update progress after each account is added one by one
        const processProgress = (current / total) * 0.5;
        await job.updateProgress({
          percent: Math.floor(progressBase + keywordWeight * (0.5 + processProgress)),
          currentKeyword: cleanHashtag,
          currentUsername: discovery.username,
          currentIndex: current,
          totalCount: total,
          added: enqueuedCount,
          skipped: skippedCount,
        });
      }
    }

    // Update final progress to 100%
    await job.updateProgress({
      percent: 100,
      added: enqueuedCount,
      skipped: skippedCount,
    });

    console.log(
      `Finished hashtag discovery job ${job.id} for keywords: ${keywords.join(", ")}. Enqueued: ${enqueuedCount}, Skipped: ${skippedCount}`
    );

    return {
      keywords,
      enqueuedCount,
      skippedCount,
      status: "success",
    };
  },
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Hashtag discovery job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Hashtag discovery job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Hashtag discovery worker listening on "${DISCOVERY_QUEUE_NAME}" queue`);
