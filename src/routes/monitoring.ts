import { Router } from "express";
import { UserMonitoring } from "../models/UserMonitoring";
import { ChangeEvent } from "../models/ChangeEvent";
import { LeadScoreHistory } from "../models/LeadScoreHistory";
import {
  getTrendingLeads,
  getRecentlyActiveUsers,
  getIntentTransitions,
} from "../services/trends/trendService";

const router = Router();

/**
 * GET /monitoring
 * Returns all user monitoring configurations.
 */
router.get("/", async (req, res, next) => {
  try {
    const configs = await UserMonitoring.find().sort({ username: 1 });
    res.json(configs);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /monitoring/trending
 * Returns users ranked by lead score increase delta.
 */
router.get("/trending", async (req, res, next) => {
  try {
    const trending = await getTrendingLeads();
    res.json(trending);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /monitoring/recent-activity
 * Returns users who recently had new posts scrape detections.
 */
router.get("/recent-activity", async (req, res, next) => {
  try {
    const active = await getRecentlyActiveUsers();
    res.json(active);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /monitoring/change-events
 * Returns the latest change events list.
 */
router.get("/change-events", async (req, res, next) => {
  try {
    const events = await ChangeEvent.find().sort({ detectedAt: -1 }).limit(50);
    res.json(events);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /monitoring/transitions
 * Returns intent transitions list.
 */
router.get("/transitions", async (req, res, next) => {
  try {
    const transitions = await getIntentTransitions();
    res.json(transitions);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /monitoring/:username/history
 * Returns the lead score history and change events of a target user.
 */
router.get("/:username/history", async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    const history = await LeadScoreHistory.find({ username }).sort({ recordedAt: 1 });
    const events = await ChangeEvent.find({ username }).sort({ detectedAt: -1 });

    res.json({
      username,
      history,
      events,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /monitoring/:username/toggle
 * Toggles a user's monitoringEnabled state.
 */
router.post("/:username/toggle", async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    let config = await UserMonitoring.findOne({ username });
    if (!config) {
      // Create if missing
      config = await UserMonitoring.create({
        username,
        lastCheckedAt: new Date(0),
        lastPostCount: 0,
        lastPostIds: [],
        monitoringEnabled: true,
        totalChecks: 0,
        totalChangesDetected: 0,
      });
    } else {
      config.monitoringEnabled = !config.monitoringEnabled;
      await config.save();
    }

    res.json({
      username,
      monitoringEnabled: config.monitoringEnabled,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
