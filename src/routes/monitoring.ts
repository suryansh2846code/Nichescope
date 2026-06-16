import { Router } from "express";
import { UserMonitoring } from "../models/UserMonitoring";

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
