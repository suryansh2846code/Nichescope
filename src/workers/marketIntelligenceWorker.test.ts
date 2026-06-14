import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { Post } from "../models/Post";
import { PostAnalysis } from "../models/PostAnalysis";
import { UserIntelligence } from "../models/UserIntelligence";
import { MarketSnapshot } from "../models/MarketSnapshot";
import { TrendEvent } from "../models/TrendEvent";
import { processMarketJob } from "./marketIntelligenceWorker";

describe("Market Intelligence Worker & Aggregations", () => {
  beforeAll(async () => {
    await connectToDatabase();
    // Clean up
    await Post.deleteMany({});
    await PostAnalysis.deleteMany({});
    await UserIntelligence.deleteMany({});
    await MarketSnapshot.deleteMany({});
    await TrendEvent.deleteMany({});
  });

  afterAll(async () => {
    await Post.deleteMany({});
    await PostAnalysis.deleteMany({});
    await UserIntelligence.deleteMany({});
    await MarketSnapshot.deleteMany({});
    await TrendEvent.deleteMany({});
    await mongoose.connection.close();
  });

  test("processes market job, aggregates stats, and detects trends on second snapshot", async () => {
    // 1. Create dummy users, posts, and analyses
    const username1 = "test_market_user_1";
    const username2 = "test_market_user_2";

    await UserIntelligence.create({
      username: username1,
      overallCategory: "healthcare",
      overallIntent: "seeking_help",
      confidence: 90,
      leadScore: 90,
      summary: "Struggling with acne.",
      postCountAnalyzed: 1,
      leadPostCount: 1,
      categories: [{ category: "healthcare", count: 1 }],
      intents: [{ intent: "seeking_help", count: 1 }],
      analyzedAt: new Date(),
    });

    await UserIntelligence.create({
      username: username2,
      overallCategory: "fitness",
      overallIntent: "purchase_intent",
      confidence: 85,
      leadScore: 80,
      summary: "Looking to buy gym shoes.",
      postCountAnalyzed: 1,
      leadPostCount: 1,
      categories: [{ category: "fitness", count: 1 }],
      intents: [{ intent: "purchase_intent", count: 1 }],
      analyzedAt: new Date(),
    });

    // Create posts
    await Post.create([
      {
        postId: "post_market_1",
        username: username1,
        caption: "Need doctor recommendation for acne @doctor_bob",
        postUrl: "url1",
        hashtags: ["acne"],
        mentions: ["doctor_bob"],
        scrapedAt: new Date(),
        isAnalyzed: true,
      },
      {
        postId: "post_market_2",
        username: username2,
        caption: "Looking to buy gym shoes @nike",
        postUrl: "url2",
        hashtags: ["fitness"],
        mentions: ["nike"],
        scrapedAt: new Date(),
        isAnalyzed: true,
      },
    ]);

    // Create post analyses with sentiments
    await PostAnalysis.create([
      {
        postId: "post_market_1",
        username: username1,
        isLead: true,
        category: "healthcare",
        intent: "seeking_help",
        confidence: 90,
        leadScore: 90,
        extractedKeywords: ["acne", "doctor"],
        summary: "Struggling with acne.",
        sentiment: "negative",
        analyzedAt: new Date(),
      },
      {
        postId: "post_market_2",
        username: username2,
        isLead: true,
        category: "fitness",
        intent: "purchase_intent",
        confidence: 85,
        leadScore: 80,
        extractedKeywords: ["gym", "shoes"],
        summary: "Looking to buy gym shoes.",
        sentiment: "positive",
        analyzedAt: new Date(),
      },
    ]);

    // 2. Run first snapshot job
    const jobMock = {
      data: { timestamp: new Date().toISOString() },
      updateProgress: async (p: number) => {},
    };

    const result1 = await processMarketJob(jobMock);
    expect(result1.status).toBe("success");
    expect(result1.totalUsers).toBeGreaterThanOrEqual(2);
    expect(result1.totalPosts).toBeGreaterThanOrEqual(2);

    const snapshot1 = await MarketSnapshot.findById(result1.snapshotId);
    expect(snapshot1).not.toBeNull();
    expect(snapshot1!.totalUsers).toBeGreaterThanOrEqual(2);
    expect(snapshot1!.totalPosts).toBeGreaterThanOrEqual(2);

    // Verify category and sentiment aggregation
    const healthStat = snapshot1!.categoryStats.find((c) => c.category === "healthcare");
    expect(healthStat).toBeDefined();
    expect(healthStat!.count).toBe(1);
    expect(healthStat!.negativeSentiment).toBe(1);
    expect(healthStat!.positiveSentiment).toBe(0);

    const fitStat = snapshot1!.categoryStats.find((c) => c.category === "fitness");
    expect(fitStat).toBeDefined();
    expect(fitStat!.count).toBe(1);
    expect(fitStat!.positiveSentiment).toBe(1);
    expect(fitStat!.negativeSentiment).toBe(0);

    // Verify keyword stats
    const acneKeyword = snapshot1!.keywordStats.find((k) => k.keyword === "acne");
    expect(acneKeyword).toBeDefined();
    expect(acneKeyword!.count).toBe(1);

    // Verify top mentions
    const bobMention = snapshot1!.topMentions.find((m) => m.mention === "doctor_bob");
    expect(bobMention).toBeDefined();
    expect(bobMention!.count).toBe(1);

    // 3. Make some changes and run second snapshot to trigger trend events
    // Add a new healthcare post (with same keyword "acne" - count goes to 2, which is +100% growth)
    await Post.create({
      postId: "post_market_3",
      username: username1,
      caption: "Hormonal acne is getting worse. Need dermatologist advice @doctor_bob",
      postUrl: "url3",
      hashtags: ["acne"],
      mentions: ["doctor_bob"],
      scrapedAt: new Date(),
      isAnalyzed: true,
    });

    await PostAnalysis.create({
      postId: "post_market_3",
      username: username1,
      isLead: true,
      category: "healthcare",
      intent: "seeking_recommendation",
      confidence: 95,
      leadScore: 95,
      extractedKeywords: ["acne", "dermatologist"],
      summary: "Asking for dermatologist recommendation.",
      sentiment: "negative",
      analyzedAt: new Date(),
    });

    // Run second snapshot job
    const result2 = await processMarketJob(jobMock);
    expect(result2.status).toBe("success");

    const snapshot2 = await MarketSnapshot.findById(result2.snapshotId);
    expect(snapshot2!.totalPosts).toBeGreaterThanOrEqual(3);

    // Verify trend events
    const keywordGrowthEvents = await TrendEvent.find({ type: "keyword_growth" });
    expect(keywordGrowthEvents.length).toBeGreaterThan(0);

    const acneTrend = keywordGrowthEvents.find((e) => e.entity === "acne");
    expect(acneTrend).toBeDefined();
    expect(acneTrend!.oldValue).toBe(1);
    expect(acneTrend!.newValue).toBe(2);
    expect(acneTrend!.growthRate).toBe(100);

    // Should also trigger emerging_topic since acne growth is 100% (which is >50%)
    const emergingEvents = await TrendEvent.find({ type: "emerging_topic" });
    const acneEmerging = emergingEvents.find((e) => e.entity === "acne");
    expect(acneEmerging).toBeDefined();
    expect(acneEmerging!.growthRate).toBe(100);
  });
});
