import { SeedInfluencer } from "../../models/SeedInfluencer";

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

  // Calculate boost: (overlaps / totalFollowings) * 30
  // Clamped between 0 and 30.
  const followingBoost = Math.max(
    0,
    Math.min(30, Math.round((overlapCount / totalFollowings) * 30))
  );

  console.log(`Following Analysis for niche "${niche}": overlap=${overlapCount}/${totalFollowings}, boost=${followingBoost}`);

  return {
    followingBoost,
    overlapCount,
    matchedHandles,
  };
}
