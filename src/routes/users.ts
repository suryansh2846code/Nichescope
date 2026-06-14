import { Router } from "express";
import { UserIntelligence } from "../models/UserIntelligence";
import { PostAnalysis } from "../models/PostAnalysis";
import { Lead } from "../models/Lead";

const router = Router();

// GET /users/intelligence - fetch filtered user intelligence lead profiles
router.get("/intelligence", async (req, res, next) => {
  try {
    const { category, intent, minScore } = req.query;
    const filters: Record<string, any> = {};

    if (typeof category === "string" && category.trim() !== "") {
      filters.overallCategory = category.trim();
    }

    if (typeof intent === "string" && intent.trim() !== "") {
      filters.overallIntent = intent.trim();
    }

    if (typeof minScore === "string" && minScore.trim() !== "") {
      const scoreNum = Number(minScore);
      if (!Number.isNaN(scoreNum)) {
        filters.leadScore = { $gte: scoreNum };
      }
    }

    const results = await UserIntelligence.find(filters).sort({ leadScore: -1, updatedAt: -1 });
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// GET /users/intelligence/top-leads - fetch top scoring users
router.get("/intelligence/top-leads", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 20);
    const topLeads = await UserIntelligence.find()
      .sort({ leadScore: -1 })
      .limit(limit);
    res.json(topLeads);
  } catch (error) {
    next(error);
  }
});

// GET /users/intelligence/:username - fetch details of a single user
router.get("/intelligence/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    const normalizedUser = username.toLowerCase().trim();

    // 1. Get user intelligence profile
    const profile = await UserIntelligence.findOne({ username: normalizedUser });
    if (!profile) {
      res.status(404).json({ error: `User intelligence profile not found for @${username}` });
      return;
    }

    // 2. Fetch recent post analyses
    const recentAnalyses = await PostAnalysis.find({ username: normalizedUser })
      .sort({ leadScore: -1, createdAt: -1 })
      .limit(10);

    // 3. Fetch general lead info (profile bio, follower count, email, etc.)
    const leadInfo = await Lead.findOne({ username: new RegExp(`^${normalizedUser}$`, "i") });

    res.json({
      intelligence: profile,
      lead: leadInfo || null,
      analyses: recentAnalyses,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
