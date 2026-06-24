import { Router } from "express";
import { SystemSettings, getSystemSettings } from "../models/SystemSettings";

const router = Router();

/**
 * GET /settings
 * Returns the current global system configuration.
 */
router.get("/", async (req, res, next) => {
  try {
    const settings = await getSystemSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /settings
 * Updates system settings.
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      maxPostsScraped,
      maxHashtagPosts,
      maxCommentsScraped,
      followingBoostWeight,
      intentThreshold,
      immediateContactThreshold,
      aiProvider,
      geminiApiKey,
      openaiApiKey,
      openrouterApiKey,
      temperature,
    } = req.body;

    const update: Record<string, any> = {};

    if (maxPostsScraped !== undefined) update.maxPostsScraped = Number(maxPostsScraped);
    if (maxHashtagPosts !== undefined) update.maxHashtagPosts = Number(maxHashtagPosts);
    if (maxCommentsScraped !== undefined) update.maxCommentsScraped = Number(maxCommentsScraped);
    if (followingBoostWeight !== undefined) update.followingBoostWeight = Number(followingBoostWeight);
    if (intentThreshold !== undefined) update.intentThreshold = Number(intentThreshold);
    if (immediateContactThreshold !== undefined) update.immediateContactThreshold = Number(immediateContactThreshold);
    if (aiProvider !== undefined) update.aiProvider = String(aiProvider);
    if (geminiApiKey !== undefined) update.geminiApiKey = String(geminiApiKey);
    if (openaiApiKey !== undefined) update.openaiApiKey = String(openaiApiKey);
    if (openrouterApiKey !== undefined) update.openrouterApiKey = String(openrouterApiKey);
    if (temperature !== undefined) update.temperature = Number(temperature);

    const settings = await SystemSettings.findOneAndUpdate(
      { key: "global" },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

export default router;
