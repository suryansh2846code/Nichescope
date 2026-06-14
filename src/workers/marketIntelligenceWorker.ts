import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { MARKET_INTELLIGENCE_QUEUE_NAME, type MarketIntelligenceJobData } from "../queues/marketIntelligenceQueue";
import { UserIntelligence } from "../models/UserIntelligence";
import { Post } from "../models/Post";
import { PostAnalysis } from "../models/PostAnalysis";
import { MarketSnapshot } from "../models/MarketSnapshot";
import { TrendEvent } from "../models/TrendEvent";

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in Market Intelligence worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

export async function processMarketJob(job: {
  data: MarketIntelligenceJobData;
  updateProgress: (progress: number) => Promise<any>;
}) {
  console.log(`Starting Market Intelligence snapshot aggregation...`);
  await job.updateProgress(10);

  // 1. Total counts
  const totalUsers = await UserIntelligence.countDocuments();
  const totalPosts = await Post.countDocuments();
  await job.updateProgress(25);

  // 2. Category Stats + Sentiment stats inside them
  const categoryAgg = await PostAnalysis.aggregate([
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        positive: { $sum: { $cond: [{ $eq: ["$sentiment", "positive"] }, 1, 0] } },
        neutral: { $sum: { $cond: [{ $eq: ["$sentiment", "neutral"] }, 1, 0] } },
        negative: { $sum: { $cond: [{ $eq: ["$sentiment", "negative"] }, 1, 0] } },
      },
    },
  ]);

  const definedCategories = ["healthcare", "fitness", "technology", "beauty", "finance", "education", "recruitment", "real_estate", "general"];
  const categoryMap = new Map(categoryAgg.map((item) => [item._id, item]));
  const categoryStats = definedCategories.map((cat) => {
    const agg = categoryMap.get(cat) || { count: 0, positive: 0, neutral: 0, negative: 0 };
    return {
      category: cat,
      count: agg.count,
      positiveSentiment: agg.positive,
      neutralSentiment: agg.neutral,
      negativeSentiment: agg.negative,
    };
  });
  await job.updateProgress(45);

  // 3. Intent Stats
  const intentAgg = await PostAnalysis.aggregate([
    {
      $group: {
        _id: "$intent",
        count: { $sum: 1 },
      },
    },
  ]);

  const definedIntents = [
    "seeking_help",
    "seeking_recommendation",
    "purchase_intent",
    "discussion",
    "complaint",
    "question",
    "promotion",
    "other",
  ];
  const intentMap = new Map(intentAgg.map((item) => [item._id, item.count]));
  const intentStats = definedIntents.map((intent) => ({
    intent,
    count: intentMap.get(intent) || 0,
  }));
  await job.updateProgress(60);

  // 4. Keyword Stats
  const keywordAgg = await PostAnalysis.aggregate([
    { $unwind: "$extractedKeywords" },
    {
      $group: {
        _id: "$extractedKeywords",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 100 },
  ]);
  const keywordStats = keywordAgg
    .filter((item) => item._id && item._id.trim().length > 0)
    .map((item) => ({
      keyword: item._id.trim(),
      count: item.count,
    }));
  await job.updateProgress(75);

  // 5. Mention Stats
  const mentionsAgg = await Post.aggregate([
    { $unwind: "$mentions" },
    {
      $group: {
        _id: "$mentions",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 100 },
  ]);
  const topMentions = mentionsAgg
    .filter((item) => item._id && item._id.trim().length > 0)
    .map((item) => ({
      mention: item._id.trim(),
      count: item.count,
    }));
  await job.updateProgress(85);

  // Load previous snapshot for trend comparisons
  const previousSnapshot = await MarketSnapshot.findOne().sort({ snapshotDate: -1 });

  // Save current snapshot
  const snapshotDate = new Date();
  const currentSnapshot = await MarketSnapshot.create({
    snapshotDate,
    categoryStats,
    intentStats,
    keywordStats,
    topMentions,
    totalUsers,
    totalPosts,
  });

  console.log(`Saved MarketSnapshot: totalUsers=${totalUsers}, totalPosts=${totalPosts}`);

  // Trend detection logic
  if (previousSnapshot) {
    console.log(`Comparing against previous snapshot dated: ${previousSnapshot.snapshotDate.toISOString()}`);
    const detectedAt = new Date();

    // Keyword trends
    const prevKeywordMap = new Map(previousSnapshot.keywordStats.map((k) => [k.keyword, k.count]));
    for (const curr of keywordStats) {
      const prevCount = prevKeywordMap.get(curr.keyword) || 0;
      if (prevCount === 0) {
        // Growth rate: treat as 100% since it's newly emerged in this snapshot
        const growthRate = 100;
        await TrendEvent.create({
          type: "keyword_growth",
          entity: curr.keyword,
          oldValue: 0,
          newValue: curr.count,
          growthRate,
          detectedAt,
        });

        if (growthRate > 50) {
          await TrendEvent.create({
            type: "emerging_topic",
            entity: curr.keyword,
            oldValue: 0,
            newValue: curr.count,
            growthRate,
            detectedAt,
          });
        }
      } else {
        const growthRate = Math.round(((curr.count - prevCount) / prevCount) * 100);
        if (growthRate !== 0) {
          await TrendEvent.create({
            type: "keyword_growth",
            entity: curr.keyword,
            oldValue: prevCount,
            newValue: curr.count,
            growthRate,
            detectedAt,
          });

          if (growthRate >= 50) {
            await TrendEvent.create({
              type: "emerging_topic",
              entity: curr.keyword,
              oldValue: prevCount,
              newValue: curr.count,
              growthRate,
              detectedAt,
            });
          } else if (growthRate <= -30) {
            await TrendEvent.create({
              type: "declining_topic",
              entity: curr.keyword,
              oldValue: prevCount,
              newValue: curr.count,
              growthRate,
              detectedAt,
            });
          }
        }
      }
    }

    // Look for keywords in previous snapshot that dropped out completely
    const currKeywordMap = new Map(keywordStats.map((k) => [k.keyword, k.count]));
    for (const prev of previousSnapshot.keywordStats) {
      if (!currKeywordMap.has(prev.keyword)) {
        await TrendEvent.create({
          type: "keyword_growth",
          entity: prev.keyword,
          oldValue: prev.count,
          newValue: 0,
          growthRate: -100,
          detectedAt,
        });

        await TrendEvent.create({
          type: "declining_topic",
          entity: prev.keyword,
          oldValue: prev.count,
          newValue: 0,
          growthRate: -100,
          detectedAt,
        });
      }
    }

    // Category trends
    const prevCategoryMap = new Map(previousSnapshot.categoryStats.map((c) => [c.category, c.count]));
    for (const curr of categoryStats) {
      const prevCount = prevCategoryMap.get(curr.category) || 0;
      if (prevCount === 0 && curr.count > 0) {
        await TrendEvent.create({
          type: "category_growth",
          entity: curr.category,
          oldValue: 0,
          newValue: curr.count,
          growthRate: 100,
          detectedAt,
        });
      } else if (prevCount > 0) {
        const growthRate = Math.round(((curr.count - prevCount) / prevCount) * 100);
        if (growthRate !== 0) {
          await TrendEvent.create({
            type: "category_growth",
            entity: curr.category,
            oldValue: prevCount,
            newValue: curr.count,
            growthRate,
            detectedAt,
          });
        }
      }
    }

    // Intent trends
    const prevIntentMap = new Map(previousSnapshot.intentStats.map((i) => [i.intent, i.count]));
    for (const curr of intentStats) {
      const prevCount = prevIntentMap.get(curr.intent) || 0;
      if (prevCount === 0 && curr.count > 0) {
        await TrendEvent.create({
          type: "intent_growth",
          entity: curr.intent,
          oldValue: 0,
          newValue: curr.count,
          growthRate: 100,
          detectedAt,
        });
      } else if (prevCount > 0) {
        const growthRate = Math.round(((curr.count - prevCount) / prevCount) * 100);
        if (growthRate !== 0) {
          await TrendEvent.create({
            type: "intent_growth",
            entity: curr.intent,
            oldValue: prevCount,
            newValue: curr.count,
            growthRate,
            detectedAt,
          });
        }
      }
    }
  } else {
    console.log("First snapshot generated. No previous snapshot to compare. Skipping trend generation.");
  }

  await job.updateProgress(100);
  console.log("Finished Market Intelligence snapshot aggregation job.");

  return {
    snapshotId: currentSnapshot._id,
    totalUsers,
    totalPosts,
    status: "success",
  };
}

const worker = new Worker<MarketIntelligenceJobData>(
  MARKET_INTELLIGENCE_QUEUE_NAME,
  processMarketJob,
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Market Intelligence job ${job?.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Market Intelligence job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Market Intelligence worker listening on "${MARKET_INTELLIGENCE_QUEUE_NAME}" queue`);
