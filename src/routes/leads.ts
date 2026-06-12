import { Router } from "express";
import mongoose from "mongoose";
import { Lead } from "../models/Lead";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const lead = await Lead.create(req.body);
    res.status(201).json(lead);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { niche, minFollowers, hasEmail } = req.query;
    const filters: Record<string, unknown> = {};

    if (typeof niche === "string" && niche.trim() !== "") {
      filters.niche = niche.trim();
    }

    if (typeof minFollowers === "string" && minFollowers.trim() !== "") {
      const parsedMinFollowers = Number(minFollowers);

      if (!Number.isNaN(parsedMinFollowers)) {
        filters.followerCount = { $gte: parsedMinFollowers };
      }
    }

    if (hasEmail === "true") {
      filters.contactEmail = { $exists: true, $ne: "" };
    }

    const leads = await Lead.find(filters).sort({ scrapedAt: -1 });
    res.json(leads);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid lead id" });
      return;
    }

    const lead = await Lead.findById(id);

    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    res.json(lead);
  } catch (error) {
    next(error);
  }
});

export default router;
