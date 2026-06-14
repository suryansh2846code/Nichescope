import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { DISCOVERY_QUEUE_NAME, type DiscoveryJobData } from "../queues/discoveryQueue";
import { scrapeHashtag } from "../scraper/instagram";
import { Lead } from "../models/Lead";
import { HashtagDiscovery } from "../models/HashtagDiscovery";
import { scrapeQueue, SCRAPE_PROFILE_JOB_NAME } from "../queues/scrapeQueue";

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
    const rawHashtag = job.data.hashtag;
    const cleanHashtag = rawHashtag.replace(/^#/, "").trim().toLowerCase();
    console.log(`Starting hashtag discovery job ${job.id} for #${cleanHashtag}`);
    await job.updateProgress(10);

    const result = await scrapeHashtag(cleanHashtag, { maxPosts: 50 });
    await job.updateProgress(60);

    let enqueuedCount = 0;
    let skippedCount = 0;

    console.log(`Processing ${result.discoveries.length} discovered users for #${cleanHashtag}...`);

    for (const discovery of result.discoveries) {
      try {
        const username = discovery.username.toLowerCase();

        // 1. Check if user already exists in the leads collection
        const leadExists = await Lead.exists({
          username: new RegExp(`^${username}$`, "i"),
        });

        if (leadExists) {
          skippedCount++;
          continue;
        }

        // 2. Check if user already exists in the discoveries collection
        const discoveryExists = await HashtagDiscovery.exists({
          username: new RegExp(`^${username}$`, "i"),
        });

        if (discoveryExists) {
          skippedCount++;
          continue;
        }

        // 3. Save to HashtagDiscovery DB collection
        await HashtagDiscovery.create({
          hashtag: cleanHashtag,
          username: username,
          sourcePostUrl: discovery.sourcePostUrl,
          discoveredAt: new Date(),
        });

        // 4. Enqueue into scrapeQueue
        await scrapeQueue.add(SCRAPE_PROFILE_JOB_NAME, {
          username: username,
          niche: cleanHashtag,
        });

        enqueuedCount++;
      } catch (err) {
        // Log individual error but continue processing other discoveries
        console.error(
          `Error enqueuing discovered username "${discovery.username}":`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    await job.updateProgress(100);
    console.log(
      `Finished hashtag discovery job ${job.id} for #${cleanHashtag}. Enqueued: ${enqueuedCount}, Skipped (duplicates): ${skippedCount}`
    );

    return {
      hashtag: cleanHashtag,
      discoveredCount: result.discoveries.length,
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
