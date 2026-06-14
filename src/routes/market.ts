import { Router } from "express";
import { MarketSnapshot } from "../models/MarketSnapshot";
import { TrendEvent } from "../models/TrendEvent";
import { marketIntelligenceQueue, AGGREGATE_MARKET_JOB_NAME } from "../queues/marketIntelligenceQueue";

const router = Router();

/**
 * GET /market/overview
 * Returns total users and total posts from the latest snapshot.
 */
router.get("/overview", async (req, res, next) => {
  try {
    const latest = await MarketSnapshot.findOne().sort({ snapshotDate: -1 });
    if (!latest) {
      res.json({ totalUsers: 0, totalPosts: 0 });
      return;
    }
    res.json({
      totalUsers: latest.totalUsers,
      totalPosts: latest.totalPosts,
      snapshotDate: latest.snapshotDate,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /market/categories
 * Returns category analytics from the latest snapshot.
 */
router.get("/categories", async (req, res, next) => {
  try {
    const latest = await MarketSnapshot.findOne().sort({ snapshotDate: -1 });
    if (!latest) {
      res.json([]);
      return;
    }
    res.json(latest.categoryStats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /market/intents
 * Returns intent analytics from the latest snapshot.
 */
router.get("/intents", async (req, res, next) => {
  try {
    const latest = await MarketSnapshot.findOne().sort({ snapshotDate: -1 });
    if (!latest) {
      res.json([]);
      return;
    }
    res.json(latest.intentStats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /market/keywords
 * Returns top keywords from the latest snapshot. Supports ?limit=N.
 */
router.get("/keywords", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 50);
    const latest = await MarketSnapshot.findOne().sort({ snapshotDate: -1 });
    if (!latest) {
      res.json([]);
      return;
    }
    const keywords = latest.keywordStats.slice(0, limit);
    res.json(keywords);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /market/trends
 * Returns trend events, optionally filtered by ?type=X.
 */
router.get("/trends", async (req, res, next) => {
  try {
    const type = req.query.type as string;
    const filter = type ? { type } : {};
    const trends = await TrendEvent.find(filter).sort({ detectedAt: -1 }).limit(100);
    res.json(trends);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /market/emerging-topics
 * Returns topics with growthRate > 50%.
 * Format: [ { "topic": "dermatologist", "growthRate": 80 } ]
 */
router.get("/emerging-topics", async (req, res, next) => {
  try {
    const events = await TrendEvent.find({ type: "emerging_topic" }).sort({ detectedAt: -1 }).limit(50);
    // Deduplicate by entity/topic (keeping the latest one)
    const seen = new Set<string>();
    const result: { topic: string; growthRate: number; detectedAt: Date }[] = [];
    
    for (const evt of events) {
      if (!seen.has(evt.entity)) {
        seen.add(evt.entity);
        result.push({
          topic: evt.entity,
          growthRate: evt.growthRate,
          detectedAt: evt.detectedAt,
        });
      }
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /market/mentions
 * Returns most-mentioned accounts.
 */
router.get("/mentions", async (req, res, next) => {
  try {
    const latest = await MarketSnapshot.findOne().sort({ snapshotDate: -1 });
    if (!latest) {
      res.json([]);
      return;
    }
    res.json(latest.topMentions);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /market/trigger
 * Manually schedules a snapshot aggregation job and returns success.
 */
router.post("/trigger", async (req, res, next) => {
  try {
    const jobId = `market-snapshot-manual-${Date.now()}`;
    const job = await marketIntelligenceQueue.add(
      AGGREGATE_MARKET_JOB_NAME,
      { timestamp: new Date().toISOString() },
      { jobId }
    );
    res.json({
      success: true,
      message: "Market intelligence snapshot job enqueued successfully.",
      jobId: job.id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
