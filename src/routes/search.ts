import { Router } from "express";
import { searchSemanticPosts } from "../services/search/searchService";
import { LeadQualification } from "../models/LeadQualification";

const router = Router();

/**
 * GET /search?q=<query>
 * Returns a list of semantic search results ranked by similarity score joined with qualification profiles.
 */
router.get("/", async (req, res, next) => {
  try {
    const query = req.query.q;
    if (typeof query !== "string" || query.trim() === "") {
      res.status(400).json({ error: "Query parameter 'q' is required and cannot be empty" });
      return;
    }

    const limitQuery = req.query.limit;
    let limit = 50;
    if (typeof limitQuery === "string") {
      const parsedLimit = parseInt(limitQuery, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
      }
    }

    const results = await searchSemanticPosts(query, limit);
    const usernames = results.map((r) => r.username.toLowerCase());
    const qualifications = await LeadQualification.find({ username: { $in: usernames } });
    const qualMap = new Map(qualifications.map((q) => [q.username.toLowerCase(), q]));

    const merged = results.map((r) => {
      const q = qualMap.get(r.username.toLowerCase());
      return {
        ...r,
        problem: q?.problem || "Unknown",
        serviceNeeded: q?.serviceNeeded || "Unknown",
        buyingIntent: q?.buyingIntent || 0,
        recommendedAction: q?.recommendedAction || "Monitor",
      };
    });

    res.json(merged);
  } catch (error) {
    next(error);
  }
});

export default router;
