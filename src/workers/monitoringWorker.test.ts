import { mock } from "bun:test";

// Mock the instagram scraper module to prevent external Playwright calls
const mockScrapeProfile = mock((username: string) => {
  return {
    profile: {
      username,
      fullName: "Test User",
      bio: "Test Bio",
      followerCount: 1000,
      followingCount: 500,
      postCount: 3,
      profileUrl: `https://instagram.com/${username}`,
      scrapedAt: new Date(),
      rawData: { title: "title", description: "desc", canonicalUrl: "url" },
    },
    posts: [
      {
        postId: "post_new_1",
        caption: "This is a new fitness post #fitness",
        postUrl: "https://instagram.com/p/post_new_1",
        postedAt: new Date(),
        likes: 15,
        commentsCount: 3,
        hashtags: ["fitness"],
        mentions: [],
      },
    ],
  };
});

mock.module("../scraper/instagram", () => {
  return {
    scrapeProfile: mockScrapeProfile,
    parseInstagramCount: (val: string) => 0,
    parsePostMetaDescription: (val: string) => null,
    extractHashtags: (val: string) => [],
    extractMentions: (val: string) => [],
  };
});

import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { UserMonitoring } from "../models/UserMonitoring";
import { ChangeEvent } from "../models/ChangeEvent";
import { Post } from "../models/Post";
import { processMonitoringJob } from "./monitoringWorker";

describe("Monitoring Worker pipeline", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await UserMonitoring.deleteMany({ username: "test_monitor_user" });
    await ChangeEvent.deleteMany({ username: "test_monitor_user" });
    await Post.deleteMany({ username: "test_monitor_user" });
    mockScrapeProfile.mockClear();
  });

  test("processMonitoringJob correctly processes user and triggers change detection", async () => {
    const username = "test_monitor_user";

    // Create a config where last post was "post_old_1"
    await UserMonitoring.create({
      username,
      lastCheckedAt: new Date(0),
      lastPostCount: 1,
      lastPostIds: ["post_old_1"],
      monitoringEnabled: true,
      totalChecks: 0,
      totalChangesDetected: 0,
    });

    const mockJob = {
      data: { username },
      updateProgress: async (progress: number) => {
        return Promise.resolve();
      },
    };

    // Run monitoring worker job
    const result = await processMonitoringJob(mockJob);
    expect(result.status).toBe("success");
    expect(result.newPostsDetected).toBe(1);

    // Verify UserMonitoring updates
    const updated = await UserMonitoring.findOne({ username });
    expect(updated).not.toBeNull();
    expect(updated!.totalChecks).toBe(1);
    expect(updated!.totalChangesDetected).toBe(1);
    expect(updated!.lastPostCount).toBe(1); // from mockScrapeProfile post list length
    expect(updated!.lastPostIds).toContain("post_new_1");

    // Verify ChangeEvent creation
    const event = await ChangeEvent.findOne({ username, changeType: "new_posts" });
    expect(event).not.toBeNull();
    expect(event!.delta).toBe(1);

    // Verify Post saved in DB
    const post = await Post.findOne({ postId: "post_new_1" });
    expect(post).not.toBeNull();
    expect(post!.caption).toContain("new fitness post");
  });

  test("processMonitoringJob skips if configuration is disabled", async () => {
    const username = "test_monitor_user";

    // Create a disabled config
    await UserMonitoring.create({
      username,
      lastCheckedAt: new Date(0),
      lastPostCount: 0,
      lastPostIds: [],
      monitoringEnabled: false,
      totalChecks: 0,
      totalChangesDetected: 0,
    });

    const mockJob = {
      data: { username },
      updateProgress: async (progress: number) => {
        return Promise.resolve();
      },
    };

    const result = await processMonitoringJob(mockJob);
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("disabled");

    expect(mockScrapeProfile).not.toHaveBeenCalled();
  });
});
