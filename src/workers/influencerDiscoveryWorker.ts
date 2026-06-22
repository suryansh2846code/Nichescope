import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import {
  INFLUENCER_DISCOVERY_QUEUE_NAME,
  type InfluencerDiscoveryJobData,
  commentScrapeQueue,
  COMMENT_SCRAPE_JOB_NAME,
} from "../queues/commentQueues";
import { SeedInfluencer } from "../models/SeedInfluencer";
import { scrapeProfile } from "../scraper/instagram";
import { setupWorkerLogger } from "../utils/logger";

// Setup logging interceptor
setupWorkerLogger("influencer-discovery");

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in influencer discovery worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

const worker = new Worker<InfluencerDiscoveryJobData>(
  INFLUENCER_DISCOVERY_QUEUE_NAME,
  async (job) => {
    console.log(`Starting influencer discovery job ${job.id}`);
    
    // Fetch active seed influencers
    const influencers = await SeedInfluencer.find({ isActive: true });
    console.log(`Found ${influencers.length} active seed influencers to scan.`);

    let totalEnqueued = 0;

    for (const influencer of influencers) {
      console.log(`Scanning seed influencer: @${influencer.username} (niche: ${influencer.niche})`);
      
      try {
        // Scrape the latest 5 posts of the seed influencer
        const result = await scrapeProfile(influencer.username, {
          maxPosts: 5,
        });

        const posts = result.posts || [];
        console.log(`Found ${posts.length} posts for @${influencer.username}`);

        if (posts.length > 0) {
          // Track the latest post ID as the last processed post
          const latestPost = posts[0]!;
          influencer.lastProcessedPostId = latestPost.postId;
          influencer.updatedAt = new Date();
          await influencer.save();

          for (const post of posts) {
            const jobId = `comments-${post.postId}`;
            console.log(`Enqueuing comment scrape for post ${post.postId} (${post.postUrl})`);

            await commentScrapeQueue.add(
              COMMENT_SCRAPE_JOB_NAME,
              {
                postUrl: post.postUrl,
                niche: influencer.niche,
              },
              { jobId } // Deduplicates at BullMQ queue level
            );
            totalEnqueued++;
          }
        }
      } catch (err) {
        console.error(
          `Failed to discover posts for seed influencer @${influencer.username}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    return {
      scannedInfluencersCount: influencers.length,
      enqueuedPostScrapesCount: totalEnqueued,
      status: "success",
    };
  },
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Influencer discovery job ${job.id} completed successfully`);
});

worker.on("failed", (job, error) => {
  console.error(`Influencer discovery job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Influencer discovery worker listening on "${INFLUENCER_DISCOVERY_QUEUE_NAME}" queue`);
