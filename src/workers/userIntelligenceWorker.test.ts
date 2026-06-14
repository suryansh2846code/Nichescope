import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { Post } from "../models/Post";
import { PostAnalysis } from "../models/PostAnalysis";
import { UserIntelligence } from "../models/UserIntelligence";
import { processUserIntelligenceJob } from "./userIntelligenceWorker";

describe("User Intelligence Worker Processing", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear test posts, analyses, and user intelligence
    await Post.deleteMany({ username: "mock_user_intel" });
    await PostAnalysis.deleteMany({ username: "mock_user_intel" });
    await UserIntelligence.deleteMany({ username: "mock_user_intel" });
  });

  test("skips processing gracefully if no post analyses exist", async () => {
    const mockJob = {
      data: { username: "mock_user_intel" },
      updateProgress: async (progress: number) => {
        return Promise.resolve();
      },
    };

    const result = await processUserIntelligenceJob(mockJob);
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("no_analyses");

    const record = await UserIntelligence.findOne({ username: "mock_user_intel" });
    expect(record).toBeNull();
  });

  test("aggregates multiple post analyses and saves user lead profile", async () => {
    const username = "mock_user_intel";

    // 1. Create fake posts with captions
    await Post.create([
      {
        postId: "post_intel_1",
        username,
        caption: "I need skincare advice for acne #health",
        postUrl: "https://instagram.com/p/post_intel_1",
        postedAt: new Date("2026-06-01T12:00:00Z"),
        likes: 10,
        commentsCount: 1,
        hashtags: ["health"],
        mentions: [],
      },
      {
        postId: "post_intel_2",
        username,
        caption: "Struggling with eczema, please help #healthcare",
        postUrl: "https://instagram.com/p/post_intel_2",
        postedAt: new Date("2026-06-05T12:00:00Z"),
        likes: 12,
        commentsCount: 2,
        hashtags: ["healthcare"],
        mentions: [],
      },
      {
        postId: "post_intel_3",
        username,
        caption: "Can someone help me find a good gym routine? #fitness",
        postUrl: "https://instagram.com/p/post_intel_3",
        postedAt: new Date("2026-06-10T12:00:00Z"),
        likes: 50,
        commentsCount: 5,
        hashtags: ["fitness"],
        mentions: [],
      },
    ]);

    // 2. Create fake post analyses
    await PostAnalysis.create([
      {
        postId: "post_intel_1",
        username,
        isLead: true,
        category: "healthcare",
        intent: "seeking_recommendation",
        confidence: 95,
        leadScore: 90, // isLead(40) + conf(30) + intent(20) = 90
        extractedKeywords: ["skincare", "acne"],
        summary: "User needs skincare advice for acne.",
        analyzedAt: new Date(),
      },
      {
        postId: "post_intel_2",
        username,
        isLead: true,
        category: "healthcare",
        intent: "seeking_help",
        confidence: 92,
        leadScore: 90, // isLead(40) + conf(30) + intent(20) = 90
        extractedKeywords: ["eczema", "help"],
        summary: "User struggles with eczema and needs help.",
        analyzedAt: new Date(),
      },
      {
        postId: "post_intel_3",
        username,
        isLead: true,
        category: "fitness",
        intent: "seeking_help",
        confidence: 85,
        leadScore: 70, // isLead(40) + intent(20) + caption>30(10) = 70
        extractedKeywords: ["gym", "workout"],
        summary: "User needs help with a gym routine.",
        analyzedAt: new Date(),
      },
    ]);

    // Mock BullMQ job
    const mockJob = {
      data: { username },
      updateProgress: async (progress: number) => {
        return Promise.resolve();
      },
    };

    // 3. Process the aggregation job
    const result = await processUserIntelligenceJob(mockJob);
    expect(result.status).toBe("success");
    expect(result.username).toBe(username);
    expect(result.overallCategory).toBe("healthcare"); // healthcare=2, fitness=1
    expect(result.overallIntent).toBe("seeking_help"); // seeking_help=2, seeking_recommendation=1

    // 4. Verify database persistence
    const uIntel = await UserIntelligence.findOne({ username });
    expect(uIntel).not.toBeNull();
    expect(uIntel!.overallCategory).toBe("healthcare");
    expect(uIntel!.overallIntent).toBe("seeking_help");
    expect(uIntel!.postCountAnalyzed).toBe(3);
    expect(uIntel!.leadPostCount).toBe(3);

    // Verify category distributions
    const healthcareCat = uIntel!.categories.find((c) => c.category === "healthcare");
    const fitnessCat = uIntel!.categories.find((c) => c.category === "fitness");
    expect(healthcareCat!.count).toBe(2);
    expect(fitnessCat!.count).toBe(1);

    // Verify firstSeenAt and lastSeenAt dates (oldest and newest post dates)
    expect(uIntel!.firstSeenAt!.toISOString()).toBe("2026-06-01T12:00:00.000Z");
    expect(uIntel!.lastSeenAt!.toISOString()).toBe("2026-06-10T12:00:00.000Z");

    // Verify score calculation
    // averagePostLeadScore = (90 + 90 + 70) / 3 = 83.333
    // leadPostCount = 3 (so +20)
    // overallIntent = seeking_help (+15)
    // averageConfidence = (95 + 92 + 85) / 3 = 90.667 (> 90, so +15)
    // score = 83.333 * 0.5 (41.666) + 20 (count) + 15 (intent) + 15 (conf) = 91.666 => Round to 92
    expect(uIntel!.leadScore).toBe(92);

    // Verify AI Summary was generated
    expect(uIntel!.summary).toBeDefined();
    expect(uIntel!.summary.length).toBeLessThanOrEqual(250);
  });
});
