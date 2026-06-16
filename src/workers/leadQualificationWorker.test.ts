import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { Post } from "../models/Post";
import { PostAnalysis } from "../models/PostAnalysis";
import { UserIntelligence } from "../models/UserIntelligence";
import { LeadQualification } from "../models/LeadQualification";
import { processLeadQualificationJob } from "./leadQualificationWorker";

describe("Lead Qualification Worker", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Post.deleteMany({});
    await PostAnalysis.deleteMany({});
    await UserIntelligence.deleteMany({});
    await LeadQualification.deleteMany({});
  });

  test("skips processing if no UserIntelligence exists", async () => {
    const username = "mock_qualify_user";
    const mockJob = {
      data: { username },
      updateProgress: async (progress: number) => {},
    };

    const result = await processLeadQualificationJob(mockJob);
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("no_user_intelligence");

    const record = await LeadQualification.findOne({ username });
    expect(record).toBeNull();
  });

  test("qualifies lead, assigns recommendedAction, gathers supporting posts and saves", async () => {
    const username = "mock_qualify_user";

    // 1. Create UserIntelligence
    await UserIntelligence.create({
      username,
      overallCategory: "healthcare",
      overallIntent: "seeking_recommendation",
      confidence: 95,
      leadScore: 92,
      summary: "User repeatedly asks for dermatologist recommendations regarding acne.",
      postCountAnalyzed: 1,
      leadPostCount: 1,
      categories: [{ category: "healthcare", count: 1 }],
      intents: [{ intent: "seeking_recommendation", count: 1 }],
      analyzedAt: new Date(),
    });

    // 2. Create Post
    await Post.create({
      postId: "post_qualify_1",
      username,
      caption: "I need dermatologist advice for my acne breakouts!",
      postUrl: "https://instagram.com/p/post_qualify_1",
      postedAt: new Date(),
      scrapedAt: new Date(),
    });

    // 3. Create PostAnalysis (with isLead = true)
    await PostAnalysis.create({
      postId: "post_qualify_1",
      username,
      isLead: true,
      category: "healthcare",
      intent: "seeking_recommendation",
      confidence: 95,
      leadScore: 92,
      summary: "Wants dermatologist recommendations.",
      analyzedAt: new Date(),
    });

    const mockJob = {
      data: { username },
      updateProgress: async (progress: number) => {},
    };

    const result = await processLeadQualificationJob(mockJob);
    expect(result.status).toBe("success");
    expect(result.username).toBe(username);
    expect(result.urgency).toBe("high");
    expect(result.recommendedAction).toBe("Contact immediately"); // buyingIntent 92 > 85

    // 4. Verify in Database
    const qualified = await LeadQualification.findOne({ username });
    expect(qualified).not.toBeNull();
    expect(qualified!.problem).toBe("Acne");
    expect(qualified!.serviceNeeded).toBe("Dermatologist");
    expect(qualified!.urgency).toBe("high");
    expect(qualified!.buyingIntent).toBe(92);
    expect(qualified!.confidence).toBe(95);
    expect(qualified!.recommendedAction).toBe("Contact immediately");
    expect(qualified!.supportingPosts).toContain("https://instagram.com/p/post_qualify_1");
  });
});
