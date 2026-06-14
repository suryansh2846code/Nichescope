import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { MONITORING_QUEUE_NAME, type MonitoringJobData } from "../queues/monitoringQueue";
import { UserMonitoring } from "../models/UserMonitoring";
import { ChangeEvent } from "../models/ChangeEvent";
import { Post } from "../models/Post";
import { Lead } from "../models/Lead";
import { scrapeProfile } from "../scraper/instagram";
import { saveOrUpdateScrapedProfile } from "./saveLead";
import { saveOrUpdatePosts } from "./savePost";

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in monitoring worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

export async function processMonitoringJob(job: {
  data: MonitoringJobData;
  updateProgress: (progress: number) => Promise<any>;
}) {
  const { username } = job.data;
  const cleanUsername = username.toLowerCase().trim();
  console.log(`Starting Lead Monitoring recheck for @${cleanUsername}`);
  await job.updateProgress(10);

  // 1. Fetch UserMonitoring config, create if missing
  let config = await UserMonitoring.findOne({ username: cleanUsername });
  
  if (!config) {
    console.log(`No monitoring configuration found for @${cleanUsername}. Initializing from DB...`);
    const existingPosts = await Post.find({ username: cleanUsername });
    const postIds = existingPosts.map((p) => p.postId);
    
    config = await UserMonitoring.create({
      username: cleanUsername,
      lastCheckedAt: new Date(0), // checked in the past
      lastPostCount: existingPosts.length,
      lastPostIds: postIds,
      monitoringEnabled: true,
      totalChecks: 0,
      totalChangesDetected: 0,
    });
  }
  await job.updateProgress(20);

  if (!config.monitoringEnabled) {
    console.log(`Monitoring is disabled for @${cleanUsername}. Skipping.`);
    await job.updateProgress(100);
    return { username: cleanUsername, status: "skipped", reason: "disabled" };
  }

  // 2. Perform Profile Re-Scrape
  const { profile, posts } = await scrapeProfile(cleanUsername);
  await job.updateProgress(60);

  // 3. Find any new posts
  const existingPostIds = new Set(config.lastPostIds);
  const newPosts = posts.filter((p) => !existingPostIds.has(p.postId));
  
  let changesDetected = false;
  let newPostCount = newPosts.length;

  if (newPostCount > 0) {
    console.log(`Detected ${newPostCount} new posts for @${cleanUsername}`);
    changesDetected = true;

    // Fetch existing niche from Lead DB or default
    const existingLead = await Lead.findOne({
      username: new RegExp(`^${cleanUsername}$`, "i"),
    });
    const niche = existingLead?.niche || "monitored";

    // Update profile info
    await saveOrUpdateScrapedProfile(niche, profile);

    // Save and enqueue new posts for AI analysis
    await saveOrUpdatePosts(cleanUsername, newPosts);

    // Log the ChangeEvent
    await ChangeEvent.create({
      username: cleanUsername,
      changeType: "new_posts",
      delta: newPostCount,
      detectedAt: new Date(),
    });
  }
  await job.updateProgress(80);

  // 4. Update UserMonitoring metadata
  config.lastCheckedAt = new Date();
  config.lastPostCount = posts.length;
  config.lastPostIds = posts.map((p) => p.postId);
  config.totalChecks += 1;
  if (changesDetected) {
    config.totalChangesDetected += 1;
  }

  await config.save();
  await job.updateProgress(100);

  console.log(
    `Finished Lead Monitoring recheck for @${cleanUsername}. Checks: ${config.totalChecks}, New Posts: ${newPostCount}`
  );

  return {
    username: cleanUsername,
    newPostsDetected: newPostCount,
    totalChecks: config.totalChecks,
    status: "success",
  };
}

const worker = new Worker<MonitoringJobData>(
  MONITORING_QUEUE_NAME,
  processMonitoringJob,
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Lead Monitoring job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Lead Monitoring job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Lead Monitoring worker listening on "${MONITORING_QUEUE_NAME}" queue`);
