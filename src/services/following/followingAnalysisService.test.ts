import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../../db";
import { SeedInfluencer } from "../../models/SeedInfluencer";
import { analyzeFollowingList } from "./followingAnalysisService";

describe("Following List Overlay Service", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear test seed influencers
    await SeedInfluencer.deleteMany({});
  });

  test("returns 0 boost if followingHandles list is empty", async () => {
    const result = await analyzeFollowingList([], "test_niche");
    expect(result.followingBoost).toBe(0);
    expect(result.overlapCount).toBe(0);
    expect(result.matchedHandles.length).toBe(0);
  });

  test("calculates positive boost for matches in SeedInfluencer list", async () => {
    // Setup seed influencers
    await SeedInfluencer.create([
      { username: "fit_influencer_1", niche: "test_niche", isActive: true },
      { username: "fit_influencer_2", niche: "test_niche", isActive: true },
      { username: "fit_influencer_3", niche: "test_niche", isActive: false }, // inactive
    ]);

    const followingHandles = [
      "fit_influencer_1",     // match
      "fit_influencer_2",     // match
      "fit_influencer_3",     // inactive - should be ignored
      "some_other_account_1",
      "some_other_account_2",
    ];

    const result = await analyzeFollowingList(followingHandles, "test_niche");

    // Total followings checked: 5
    // Active niche overlaps: 2 (fit_influencer_1, fit_influencer_2)
    // Boost = Math.round((2 / 5) * 30) = 12
    expect(result.overlapCount).toBe(2);
    expect(result.followingBoost).toBe(12);
    expect(result.matchedHandles).toContain("fit_influencer_1");
    expect(result.matchedHandles).toContain("fit_influencer_2");
    expect(result.matchedHandles).not.toContain("fit_influencer_3");
  });

  test("ignores matches for different niches", async () => {
    await SeedInfluencer.create([
      { username: "fit_influencer_1", niche: "test_niche_2", isActive: true },
    ]);

    const followingHandles = ["fit_influencer_1"];
    const result = await analyzeFollowingList(followingHandles, "test_niche");
    expect(result.overlapCount).toBe(0);
    expect(result.followingBoost).toBe(0);
  });
});
