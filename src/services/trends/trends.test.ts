import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../../db";
import { LeadScoreHistory } from "../../models/LeadScoreHistory";
import { ChangeEvent } from "../../models/ChangeEvent";
import {
  getTrendingLeads,
  getRecentlyActiveUsers,
  getIntentTransitions,
} from "./trendService";

describe("Trends Service Analytics", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear test records
    await LeadScoreHistory.deleteMany({ username: /test_trend_/ });
    await ChangeEvent.deleteMany({ username: /test_trend_/ });
  });

  test("getTrendingLeads resolves growth scores correctly", async () => {
    const user1 = "test_trend_user_1"; // Growth +50 (40 -> 90)
    const user2 = "test_trend_user_2"; // Growth +10 (60 -> 70)
    const user3 = "test_trend_user_3"; // Growth 0 (80 -> 80)

    // Log histories for user 1
    await LeadScoreHistory.create({
      username: user1,
      leadScore: 40,
      category: "healthcare",
      intent: "discussion",
      recordedAt: new Date(Date.now() - 1000 * 60 * 10), // 10m ago
    });
    await LeadScoreHistory.create({
      username: user1,
      leadScore: 90,
      category: "healthcare",
      intent: "seeking_help",
      recordedAt: new Date(),
    });

    // Log histories for user 2
    await LeadScoreHistory.create({
      username: user2,
      leadScore: 60,
      category: "fitness",
      intent: "question",
      recordedAt: new Date(Date.now() - 1000 * 60 * 5), // 5m ago
    });
    await LeadScoreHistory.create({
      username: user2,
      leadScore: 70,
      category: "fitness",
      intent: "seeking_recommendation",
      recordedAt: new Date(),
    });

    // Log history for user 3
    await LeadScoreHistory.create({
      username: user3,
      leadScore: 80,
      category: "real_estate",
      intent: "discussion",
      recordedAt: new Date(),
    });

    const trending = await getTrendingLeads();
    
    // Filter out potential other test remnants to keep test isolated
    const filtered = trending.filter((t) => t.username.startsWith("test_trend_"));
    
    expect(filtered.length).toBe(3);
    
    // Assert ordering (largest growth first: user1(+50), then user2(+10), then user3(0))
    expect(filtered[0]!.username).toBe(user1);
    expect(filtered[0]!.scoreIncrease).toBe(50);
    expect(filtered[0]!.currentScore).toBe(90);

    expect(filtered[1]!.username).toBe(user2);
    expect(filtered[1]!.scoreIncrease).toBe(10);
    expect(filtered[1]!.currentScore).toBe(70);

    expect(filtered[2]!.username).toBe(user3);
    expect(filtered[2]!.scoreIncrease).toBe(0);
    expect(filtered[2]!.currentScore).toBe(80);
  });

  test("getRecentlyActiveUsers groups new post events", async () => {
    const user1 = "test_trend_user_4";
    const user2 = "test_trend_user_5";

    await ChangeEvent.create({
      username: user1,
      changeType: "new_posts",
      delta: 3,
      detectedAt: new Date(Date.now() - 1000 * 60), // 1m ago
    });

    await ChangeEvent.create({
      username: user2,
      changeType: "new_posts",
      delta: 5,
      detectedAt: new Date(),
    });

    const active = await getRecentlyActiveUsers();
    const filtered = active.filter((a) => a.username.startsWith("test_trend_"));

    expect(filtered.length).toBe(2);
    // User 2 should be first because it is newer
    expect(filtered[0]!.username).toBe(user2);
    expect(filtered[0]!.newPostsCount).toBe(5);

    expect(filtered[1]!.username).toBe(user1);
    expect(filtered[1]!.newPostsCount).toBe(3);
  });

  test("getIntentTransitions parses changes correctly", async () => {
    const user = "test_trend_user_6";

    await ChangeEvent.create({
      username: user,
      changeType: "intent_change",
      oldValue: "discussion",
      newValue: "seeking_help",
      detectedAt: new Date(),
    });

    await ChangeEvent.create({
      username: user,
      changeType: "category_change",
      oldValue: "fitness",
      newValue: "healthcare",
      detectedAt: new Date(Date.now() - 1000),
    });

    const transitions = await getIntentTransitions();
    const filtered = transitions.filter((t) => t.username.startsWith("test_trend_"));

    expect(filtered.length).toBe(2);
    expect(filtered[0]!.changeType).toBe("intent_change");
    expect(filtered[0]!.from).toBe("discussion");
    expect(filtered[0]!.to).toBe("seeking_help");

    expect(filtered[1]!.changeType).toBe("category_change");
    expect(filtered[1]!.from).toBe("fitness");
    expect(filtered[1]!.to).toBe("healthcare");
  });
});
