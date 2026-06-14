import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { Post } from "../models/Post";
import { PostAnalysis } from "../models/PostAnalysis";
import { saveOrUpdatePosts } from "./savePost";
import { analysisQueue } from "../queues/analysisQueue";
import { processAnalysisJob } from "./aiAnalysisWorker";

describe("AI Analysis Worker & Pipeline", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear test posts and analysis records
    await Post.deleteMany({ username: "test_ai_worker_user" });
    await PostAnalysis.deleteMany({ username: "test_ai_worker_user" });
  });

  test("saveOrUpdatePosts enqueues unanalyzed posts to analysisQueue", async () => {
    const posts = [
      {
        postId: "test_post_enq_1",
        caption: "I need a recommended fitness trainer in NYC #fitness",
        postUrl: "https://instagram.com/p/test_post_enq_1",
        postedAt: new Date(),
        likes: 10,
        commentsCount: 1,
        hashtags: ["fitness"],
        mentions: [],
      },
    ];

    // Spy on/track enqueued items from Redis queue
    const result = await saveOrUpdatePosts("test_ai_worker_user", posts);
    expect(result).not.toBeNull();

    // Verify it was saved in Post DB as unanalyzed
    const dbPost = await Post.findOne({ postId: "test_post_enq_1" });
    expect(dbPost).not.toBeNull();
    expect(dbPost!.isAnalyzed).toBeFalsy();

    // Fetch the job from Redis if enqueued
    const job = await analysisQueue.getJob("test_post_enq_1");
    expect(job).not.toBeNull();
    expect(job!.data.postId).toBe("test_post_enq_1");
    expect(job!.data.username).toBe("test_ai_worker_user");
    expect(job!.data.caption).toContain("fitness trainer");

    // Cleanup job from queue
    if (job) {
      try {
        await job.remove();
      } catch (e) {
        // Ignored
      }
    }
  });

  test("processAnalysisJob correctly performs analysis, saves to PostAnalysis, and updates Post status", async () => {
    // 1. Create a post in the database that is unanalyzed
    const postId = "test_post_proc_1";
    await Post.create({
      postId,
      username: "test_ai_worker_user",
      caption: "Can anyone suggest a good gym or yoga class nearby? #fitness #health",
      postUrl: "https://instagram.com/p/test_post_proc_1",
      postedAt: new Date(),
      likes: 5,
      commentsCount: 0,
      hashtags: ["fitness", "health"],
      mentions: [],
      isAnalyzed: false,
    });

    // Mock BullMQ job
    const mockJob = {
      data: {
        postId,
        username: "test_ai_worker_user",
        caption: "Can anyone suggest a good gym or yoga class nearby? #fitness #health",
      },
      updateProgress: async (progress: number) => {
        // Mock progress updates
        return Promise.resolve();
      },
    };

    // 2. Process the job via exported worker logic
    const processResult = await processAnalysisJob(mockJob);
    expect(processResult.status).toBe("success");
    expect(processResult.postId).toBe(postId);
    expect(processResult.isLead).toBe(true); // "suggest" maps to lead intent: seeking_recommendation
    expect(processResult.category).toBe("fitness"); // "gym" or "yoga" maps to fitness
    expect(processResult.intent).toBe("seeking_recommendation");
    expect(processResult.leadScore).toBeGreaterThanOrEqual(80); // isLead(40) + conf(30) + intent(20) + len>30(10) = 100

    // 3. Verify database updates
    // Check Post is updated to isAnalyzed: true
    const updatedPost = await Post.findOne({ postId });
    expect(updatedPost!.isAnalyzed).toBe(true);

    // Check PostAnalysis entry is created with correct properties
    const analysis = await PostAnalysis.findOne({ postId });
    expect(analysis).not.toBeNull();
    expect(analysis!.username).toBe("test_ai_worker_user");
    expect(analysis!.isLead).toBe(true);
    expect(analysis!.category).toBe("fitness");
    expect(analysis!.intent).toBe("seeking_recommendation");
    expect(analysis!.leadScore).toBe(processResult.leadScore);
    expect(analysis!.summary).toBeDefined();
    expect(analysis!.extractedKeywords).toContain("fitness");
  });
});
