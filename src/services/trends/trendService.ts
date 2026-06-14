import { LeadScoreHistory } from "../../models/LeadScoreHistory";
import { ChangeEvent } from "../../models/ChangeEvent";

/**
 * Returns users with the largest lead score increase over time.
 * Calculates delta as (latest score - earliest score) from score history.
 */
export async function getTrendingLeads() {
  const histories = await LeadScoreHistory.find().sort({ recordedAt: 1 }); // Oldest first

  const userMap = new Map<
    string,
    { initial: number; latest: number; category: string; intent: string; lastUpdated: Date }
  >();

  for (const h of histories) {
    const key = h.username.toLowerCase();
    if (!userMap.has(key)) {
      userMap.set(key, {
        initial: h.leadScore,
        latest: h.leadScore,
        category: h.category,
        intent: h.intent,
        lastUpdated: h.recordedAt,
      });
    } else {
      const entry = userMap.get(key)!;
      entry.latest = h.leadScore;
      entry.category = h.category;
      entry.intent = h.intent;
      entry.lastUpdated = h.recordedAt;
    }
  }

  const trending = [];
  for (const [username, scores] of userMap.entries()) {
    const scoreIncrease = scores.latest - scores.initial;
    trending.push({
      username,
      scoreIncrease,
      initialScore: scores.initial,
      currentScore: scores.latest,
      category: scores.category,
      intent: scores.intent,
      lastUpdated: scores.lastUpdated,
    });
  }

  // Sort descending by score increase, then current score
  return trending.sort((a, b) => b.scoreIncrease - a.scoreIncrease || b.currentScore - a.currentScore);
}

/**
 * Returns users who recently had new posts detected.
 */
export async function getRecentlyActiveUsers(limit = 20) {
  const events = await ChangeEvent.find({ changeType: "new_posts" }).sort({ detectedAt: -1 });

  const seen = new Set<string>();
  const results = [];

  for (const e of events) {
    const user = e.username.toLowerCase();
    if (!seen.has(user)) {
      seen.add(user);
      results.push({
        username: e.username,
        newPostsCount: e.delta || 0,
        detectedAt: e.detectedAt,
      });
    }
  }

  return results.slice(0, limit);
}

/**
 * Returns latest intent and category changes.
 */
export async function getIntentTransitions(limit = 30) {
  const events = await ChangeEvent.find({
    changeType: { $in: ["intent_change", "category_change"] },
  })
    .sort({ detectedAt: -1 })
    .limit(limit);

  return events.map((e) => ({
    username: e.username,
    changeType: e.changeType,
    from: e.oldValue || "unknown",
    to: e.newValue || "unknown",
    detectedAt: e.detectedAt,
  }));
}
