import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { Lead } from "../models/Lead";
import { HashtagDiscovery } from "../models/HashtagDiscovery";
import { scrapeQueue } from "../queues/scrapeQueue";

// We'll test the core logic of the worker (deduplication & queueing) by testing the database checks & enqueue functions directly.
async function processDiscoveredUser(username: string, hashtag: string, sourcePostUrl?: string) {
  const normalizedUser = username.replace(/^@/, "").trim().toLowerCase();
  const cleanHashtag = hashtag.replace(/^#/, "").trim().toLowerCase();

  // 1. Check if user already exists in the leads collection
  const leadExists = await Lead.exists({
    username: new RegExp(`^${normalizedUser}$`, "i"),
  });

  if (leadExists) {
    return { status: "skipped_lead" };
  }

  // 2. Check if user already exists in discoveries
  const discoveryExists = await HashtagDiscovery.exists({
    username: new RegExp(`^${normalizedUser}$`, "i"),
  });

  if (discoveryExists) {
    return { status: "skipped_discovery" };
  }

  // 3. Save to HashtagDiscovery collection
  await HashtagDiscovery.create({
    hashtag: cleanHashtag,
    username: normalizedUser,
    sourcePostUrl,
    discoveredAt: new Date(),
  });

  // 4. Enqueue into scrapeQueue
  const job = await scrapeQueue.add("scrape-profile", {
    username: normalizedUser,
    niche: cleanHashtag,
  });

  return { status: "enqueued", jobId: job.id };
}

describe("Hashtag Discovery pipeline core", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Delete any test records we might create
    await Lead.deleteMany({ username: { $in: ["test_discover_user_1", "test_discover_user_2"] } });
    await HashtagDiscovery.deleteMany({
      username: { $in: ["test_discover_user_1", "test_discover_user_2"] },
    });
  });

  test("enqueues a newly discovered user and records the discovery", async () => {
    const result = await processDiscoveredUser("test_discover_user_1", "skincare", "https://instagram.com/p/abc1234");
    expect(result.status).toBe("enqueued");
    expect(result.jobId).toBeDefined();

    // Check if recorded in the discovery collection
    const record = await HashtagDiscovery.findOne({ username: "test_discover_user_1" });
    expect(record).not.toBeNull();
    expect(record!.hashtag).toBe("skincare");
    expect(record!.sourcePostUrl).toBe("https://instagram.com/p/abc1234");

    // Clean up enqueued job from Redis queue if we can (ignore locks)
    if (result.jobId) {
      const job = await scrapeQueue.getJob(result.jobId);
      if (job) {
        try {
          await job.remove();
        } catch (e) {
          // Ignored if worker is already processing it
        }
      }
    }
  });

  test("skips enqueuing if username already exists in leads collection", async () => {
    // Create an existing lead
    await Lead.create({
      username: "test_discover_user_1",
      fullName: "Existing Lead",
      profileUrl: "https://instagram.com/test_discover_user_1",
      foundVia: "test",
      niche: "skincare",
    });

    const result = await processDiscoveredUser("test_discover_user_1", "skincare");
    expect(result.status).toBe("skipped_lead");

    // Check that NO record was created in the HashtagDiscovery DB
    const record = await HashtagDiscovery.findOne({ username: "test_discover_user_1" });
    expect(record).toBeNull();
  });

  test("skips enqueuing if username already exists in discoveries collection", async () => {
    // Create an existing discovery
    await HashtagDiscovery.create({
      hashtag: "skincare",
      username: "test_discover_user_2",
      discoveredAt: new Date(),
    });

    const result = await processDiscoveredUser("test_discover_user_2", "skincare");
    expect(result.status).toBe("skipped_discovery");
  });
});
