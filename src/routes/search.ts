import { Router } from "express";
import { searchSemanticPosts } from "../services/search/searchService";

const router = Router();

/**
 * GET /search?q=<query>
 * Returns a list of semantic search results ranked by similarity score.
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
    res.json(results);
  } catch (error) {
    next(error);
  }
});

export default router;
