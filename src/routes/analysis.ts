import { Router } from "express";
import { PostAnalysis } from "../models/PostAnalysis";

const router = Router();

// GET /analysis - fetch filtered lead analyses
router.get("/", async (req, res, next) => {
  try {
    const { category, minScore, intent, isLead } = req.query;
    const filters: Record<string, any> = {};

    if (typeof category === "string" && category.trim() !== "") {
      filters.category = category.trim();
    }

    if (typeof intent === "string" && intent.trim() !== "") {
      filters.intent = intent.trim();
    }

    if (typeof minScore === "string" && minScore.trim() !== "") {
      const scoreNum = Number(minScore);
      if (!Number.isNaN(scoreNum)) {
        filters.leadScore = { $gte: scoreNum };
      }
    }

    if (isLead === "true") {
      filters.isLead = true;
    } else if (isLead === "false") {
      filters.isLead = false;
    }

    const results = await PostAnalysis.find(filters).sort({ leadScore: -1, createdAt: -1 });
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// GET /analysis/top-leads - fetch top unique leads
router.get("/top-leads", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 20);

    const topLeads = await PostAnalysis.aggregate([
      { $sort: { leadScore: -1 } },
      {
        $group: {
          _id: "$username",
          username: { $first: "$username" },
          leadScore: { $first: "$leadScore" },
          category: { $first: "$category" },
          summary: { $first: "$summary" },
          postId: { $first: "$postId" },
          analyzedAt: { $first: "$analyzedAt" },
        },
      },
      { $sort: { leadScore: -1 } },
      { $limit: limit },
    ]);

    res.json(topLeads);
  } catch (error) {
    next(error);
  }
});

// GET /analysis/stats - aggregated statistics for intent/category breakdowns
router.get("/stats", async (req, res, next) => {
  try {
    const categories = await PostAnalysis.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const intents = await PostAnalysis.aggregate([
      { $group: { _id: "$intent", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const totalLeadsCount = await PostAnalysis.countDocuments({ isLead: true });

    res.json({
      categories,
      intents,
      totalLeads: totalLeadsCount,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
