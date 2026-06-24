import { SeedInfluencer } from "../../models/SeedInfluencer";
import { getSystemSettings } from "../../models/SystemSettings";

export interface FollowingAnalysisResult {
  followingBoost: number;
  overlapCount: number;
  matchedHandles: string[];
}

/**
 * Checks overlap between a user's followed accounts and the seed influencers of their niche.
 * Calculates a score boost: (overlaps / totalFollowings) * 30.
 */
export async function analyzeFollowingList(
  followingHandles: string[],
  niche: string
): Promise<FollowingAnalysisResult> {
  if (!followingHandles || followingHandles.length === 0) {
    return {
      followingBoost: 0,
      overlapCount: 0,
      matchedHandles: [],
    };
  }

  const normalizedNiche = niche.trim().toLowerCase();
  const normalizedHandles = followingHandles.map(h => h.trim().toLowerCase());

  // Retrieve active seed influencers for this niche
  const seedInfluencers = await SeedInfluencer.find({
    niche: normalizedNiche,
    isActive: true,
  });

  const seedHandles = new Set(seedInfluencers.map(s => s.username.toLowerCase().trim()));

  const matchedHandles: string[] = [];
  for (const handle of normalizedHandles) {
    if (seedHandles.has(handle)) {
      matchedHandles.push(handle);
    }
  }

  const overlapCount = matchedHandles.length;
  const totalFollowings = followingHandles.length;

  const settings = await getSystemSettings();
  const boostWeight = settings.followingBoostWeight ?? 30;

  // Calculate boost: (overlaps / totalFollowings) * boostWeight
  // Clamped between 0 and boostWeight.
  const followingBoost = Math.max(
    0,
    Math.min(boostWeight, Math.round((overlapCount / totalFollowings) * boostWeight))
  );

  console.log(`Following Analysis for niche "${niche}": overlap=${overlapCount}/${totalFollowings}, boost=${followingBoost}`);

  return {
    followingBoost,
    overlapCount,
    matchedHandles,
  };
}
