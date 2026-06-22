import { Router } from "express";
import mongoose from "mongoose";
import { Lead } from "../models/Lead";
import { Post } from "../models/Post";
import { LeadQualification } from "../models/LeadQualification";
import { UserIntelligence } from "../models/UserIntelligence";
import { LeadScoreHistory } from "../models/LeadScoreHistory";
import { PostAnalysis } from "../models/PostAnalysis";

import { SeedInfluencer } from "../models/SeedInfluencer";

const router = Router();

// ... (keep the rest as is, we'll replace the GET /inbox/:username endpoint below)
// But wait, the replace_file_content tool requires a contiguous block of text, so let's specify exactly what to replace in src/routes/leads.ts.


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

// GET /leads/export
router.get("/export", async (req, res, next) => {
  try {
    const format = req.query.format === "csv" ? "csv" : "json";
    const leads = await LeadQualification.find().sort({ qualifiedAt: -1 });

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="qualified_leads.csv"');

      const headers = ["username", "serviceNeeded", "urgency", "buyingIntent", "leadScore", "qualificationReason"];
      
      const escapeCSV = (val: any) => {
        if (val === undefined || val === null) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const headerRow = headers.join(",") + "\n";
      res.write(headerRow);

      for (const lead of leads) {
        const row = [
          escapeCSV(lead.username),
          escapeCSV(lead.serviceNeeded),
          escapeCSV(lead.urgency),
          escapeCSV(lead.buyingIntent),
          escapeCSV(lead.leadScore),
          escapeCSV(lead.qualificationReason),
        ].join(",") + "\n";
        res.write(row);
      }

      res.end();
      return;
    }

    // Default JSON response format
    const formattedJson = leads.map(lead => ({
      username: lead.username,
      serviceNeeded: lead.serviceNeeded,
      urgency: lead.urgency,
      buyingIntent: lead.buyingIntent,
      leadScore: lead.leadScore,
      qualificationReason: lead.qualificationReason
    }));
    res.json(formattedJson);
  } catch (error) {
    next(error);
  }
});

// GET /leads/inbox
router.get("/inbox", async (req, res, next) => {
  try {
    const { urgency, service, buyingIntent, category } = req.query;
    const filters: Record<string, any> = {};

    if (typeof urgency === "string" && urgency.trim() !== "") {
      filters.urgency = urgency.trim();
    }

    if (typeof service === "string" && service.trim() !== "") {
      filters.serviceNeeded = new RegExp(service.trim(), "i");
    }

    if (typeof buyingIntent === "string" && buyingIntent.trim() !== "") {
      const intentVal = Number(buyingIntent);
      if (!isNaN(intentVal)) {
        filters.buyingIntent = { $gte: intentVal };
      }
    }

    if (typeof category === "string" && category.trim() !== "") {
      filters.category = new RegExp(`^${category.trim()}$`, "i");
    }

    const leads = await LeadQualification.find(filters).sort({ qualifiedAt: -1 });
    res.json(leads);
  } catch (error) {
    next(error);
  }
});

// GET /leads/inbox/:username
/*
router.get("/inbox/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) {
      res.status(400).json({ error: "username parameter is required" });
      return;
    }

    const normalizedUser = username.toLowerCase().trim();

    // 1. Fetch LeadQualification record
    const qualification = await LeadQualification.findOne({ username: normalizedUser });
    if (!qualification) {
      res.status(404).json({ error: "Lead qualification not found for this user" });
      return;
    }

    // 2. Fetch UserIntelligence record
    const userIntelligence = await UserIntelligence.findOne({ username: normalizedUser });

    // 3. Fetch supporting posts (original Post records matching postIds of user's analyzed posts)
    const analyses = await PostAnalysis.find({ username: normalizedUser });
    const postIds = analyses.map((a) => a.postId);
    const supportingPosts = await Post.find({ postId: { $in: postIds } }).sort({ postedAt: -1 });

    // 4. Fetch LeadScoreHistory records for user
    const leadHistory = await LeadScoreHistory.find({ username: normalizedUser }).sort({ recordedAt: 1 });

    res.json({
      qualification,
      supportingPosts,
      userIntelligence,
      leadHistory,
    });
  } catch (error) {
    next(error);
  }
});
*/

router.get("/inbox/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) {
      res.status(400).json({ error: "username parameter is required" });
      return;
    }

    const normalizedUser = username.toLowerCase().trim();

    // 1. Fetch LeadQualification record
    const qualification = await LeadQualification.findOne({ username: normalizedUser });
    if (!qualification) {
      res.status(404).json({ error: "Lead qualification not found for this user" });
      return;
    }

    // 2. Fetch UserIntelligence record
    const userIntelligence = await UserIntelligence.findOne({ username: normalizedUser });

    // 3. Fetch supporting posts (original Post records matching postIds of user's analyzed posts)
    const analyses = await PostAnalysis.find({ username: normalizedUser });
    const postIds = analyses.map((a) => a.postId);
    const supportingPosts = await Post.find({ postId: { $in: postIds } }).sort({ postedAt: -1 });

    // 4. Fetch LeadScoreHistory records for user
    const leadHistory = await LeadScoreHistory.find({ username: normalizedUser }).sort({ recordedAt: 1 });

    // 5. Fetch Lead profile & Following list overlap
    const lead = await Lead.findOne({ username: new RegExp(`^${normalizedUser}$`, "i") });
    let matchedFollowings: string[] = [];
    if (lead && lead.followingHandles && lead.followingHandles.length > 0) {
      const activeSeeds = await SeedInfluencer.find({
        username: { $in: lead.followingHandles.map((h: string) => h.toLowerCase().trim()) },
        isActive: true
      });
      matchedFollowings = activeSeeds.map((s: any) => s.username);
    }

    res.json({
      qualification,
      supportingPosts,
      userIntelligence,
      leadHistory,
      lead,
      matchedFollowings
    });
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

router.get("/:username/posts", async (req, res, next) => {
  try {
    const { username } = req.params;

    if (!username) {
      res.status(400).json({ error: "username is required" });
      return;
    }

    const posts = await Post.find({
      username: new RegExp(`^${username.replace(/^@/, "").trim()}$`, "i"),
    }).sort({ postedAt: -1 });

    res.json(posts);
  } catch (error) {
    next(error);
  }
});

export default router;
