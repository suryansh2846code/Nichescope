import { Router } from "express";
import { LeadPipeline } from "../models/LeadPipeline";
import { LeadActivity } from "../models/LeadActivity";
import { LeadQualification } from "../models/LeadQualification";
import { UserIntelligence } from "../models/UserIntelligence";
import { Lead } from "../models/Lead";
import { SeedInfluencer } from "../models/SeedInfluencer";

const router = Router();

// GET /crm/leads - Get all leads in pipeline with filters and qualification join
router.get("/leads", async (req, res, next) => {
  try {
    const { status, priority, assignedTo } = req.query;
    const filters: Record<string, unknown> = {};

    if (typeof status === "string" && status.trim() !== "") {
      filters.status = status.trim();
    }

    if (typeof priority === "string" && priority.trim() !== "") {
      filters.priority = priority.trim();
    }

    if (typeof assignedTo === "string" && assignedTo.trim() !== "") {
      filters.assignedTo = assignedTo.trim();
    }

    const pipelines = await LeadPipeline.find(filters).sort({ lastActivityAt: -1 });
    const usernames = pipelines.map((p) => p.username);
    
    const qualifications = await LeadQualification.find({ username: { $in: usernames } });
    const qualMap = new Map(qualifications.map((q) => [q.username, q]));

    const results = pipelines.map((p) => {
      const q = qualMap.get(p.username);
      return {
        ...p.toObject(),
        problem: q?.problem || "Unknown",
        serviceNeeded: q?.serviceNeeded || "Unknown",
        buyingIntent: q?.buyingIntent || 0,
        leadScore: q?.leadScore || 0,
      };
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// GET /crm/stats - CRM column aggregation and conversion metrics
router.get("/stats", async (req, res, next) => {
  try {
    const counts = await LeadPipeline.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const stats: Record<string, number> = {
      new: 0,
      contacted: 0,
      interested: 0,
      qualified: 0,
      converted: 0,
      lost: 0,
    };

    let total = 0;
    for (const c of counts) {
      if (c._id in stats) {
        stats[c._id] = c.count;
      }
      total += c.count;
    }

    const countConverted = stats.converted || 0;
    const conversionRate = total > 0 ? parseFloat(((countConverted / total) * 100).toFixed(1)) : 0.0;

    res.json({
      ...stats,
      conversionRate,
    });
  } catch (error) {
    next(error);
  }
});

// GET /crm/activity - Global activity feed logs
router.get("/activity", async (req, res, next) => {
  try {
    const activities = await LeadActivity.find().sort({ createdAt: -1 }).limit(50);
    res.json(activities);
  } catch (error) {
    next(error);
  }
});

// GET /crm/leads/:username - Lead deep-dive
/*
router.get("/leads/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) {
      res.status(400).json({ error: "username is required" });
      return;
    }

    const normalizedUser = username.toLowerCase().trim();

    const pipeline = await LeadPipeline.findOne({ username: normalizedUser });
    if (!pipeline) {
      res.status(404).json({ error: "Lead pipeline not found" });
      return;
    }

    const qualification = await LeadQualification.findOne({ username: normalizedUser });
    const userIntelligence = await UserIntelligence.findOne({ username: normalizedUser });
    const activity = await LeadActivity.find({ username: normalizedUser }).sort({ createdAt: -1 });

    res.json({
      pipeline,
      qualification,
      userIntelligence,
      activity,
    });
  } catch (error) {
    next(error);
  }
});
*/

router.get("/leads/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) {
      res.status(400).json({ error: "username is required" });
      return;
    }

    const normalizedUser = username.toLowerCase().trim();

    const pipeline = await LeadPipeline.findOne({ username: normalizedUser });
    if (!pipeline) {
      res.status(404).json({ error: "Lead pipeline not found" });
      return;
    }

    const qualification = await LeadQualification.findOne({ username: normalizedUser });
    const userIntelligence = await UserIntelligence.findOne({ username: normalizedUser });
    const activity = await LeadActivity.find({ username: normalizedUser }).sort({ createdAt: -1 });

    // Fetch Lead profile & Following list overlap
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
      pipeline,
      qualification,
      userIntelligence,
      activity,
      lead,
      matchedFollowings
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /crm/leads/:username/status - Update lead status
router.patch("/leads/:username/status", async (req, res, next) => {
  try {
    const { username } = req.params;
    const { status } = req.body;

    if (!username || !status) {
      res.status(400).json({ error: "username and status are required" });
      return;
    }

    const normalizedUser = username.toLowerCase().trim();
    let pipeline = await LeadPipeline.findOne({ username: normalizedUser });
    if (!pipeline) {
      pipeline = await LeadPipeline.create({
        username: normalizedUser,
        status: status,
        priority: "medium",
        assignedTo: "",
        notes: [],
        tags: [],
        lastActivityAt: new Date(),
      });

      await LeadActivity.create({
        username: normalizedUser,
        type: "created",
        newValue: status,
        createdAt: new Date(),
      });
    } else {
      const oldStatus = pipeline.status;
      pipeline.status = status;
      pipeline.lastActivityAt = new Date();
      await pipeline.save();

      let activityType: "converted" | "lost" | "status_changed" = "status_changed";
      if (status === "converted") {
        activityType = "converted";
      } else if (status === "lost") {
        activityType = "lost";
      }

      await LeadActivity.create({
        username: normalizedUser,
        type: activityType,
        oldValue: oldStatus,
        newValue: status,
        createdAt: new Date(),
      });
    }

    res.json(pipeline);
  } catch (error) {
    next(error);
  }
});

// PATCH /crm/leads/:username/assign - Assign lead ownership
router.patch("/leads/:username/assign", async (req, res, next) => {
  try {
    const { username } = req.params;
    const { assignedTo } = req.body;

    if (!username) {
      res.status(400).json({ error: "username is required" });
      return;
    }

    const normalizedUser = username.toLowerCase().trim();
    const pipeline = await LeadPipeline.findOne({ username: normalizedUser });
    if (!pipeline) {
      res.status(404).json({ error: "Lead pipeline not found" });
      return;
    }

    const oldAssigned = pipeline.assignedTo;
    pipeline.assignedTo = assignedTo;
    pipeline.lastActivityAt = new Date();
    await pipeline.save();

    await LeadActivity.create({
      username: normalizedUser,
      type: "assigned",
      oldValue: oldAssigned,
      newValue: assignedTo,
      createdAt: new Date(),
    });

    res.json(pipeline);
  } catch (error) {
    next(error);
  }
});

// POST /crm/leads/:username/notes - Add note log
router.post("/leads/:username/notes", async (req, res, next) => {
  try {
    const { username } = req.params;
    const { content } = req.body;

    if (!username || !content) {
      res.status(400).json({ error: "username and content are required" });
      return;
    }

    const normalizedUser = username.toLowerCase().trim();
    const pipeline = await LeadPipeline.findOne({ username: normalizedUser });
    if (!pipeline) {
      res.status(404).json({ error: "Lead pipeline not found" });
      return;
    }

    pipeline.notes.push({
      content: content.trim(),
      createdAt: new Date(),
    });
    pipeline.lastActivityAt = new Date();
    await pipeline.save();

    await LeadActivity.create({
      username: normalizedUser,
      type: "note_added",
      newValue: content.trim(),
      createdAt: new Date(),
    });

    res.json(pipeline);
  } catch (error) {
    next(error);
  }
});

// POST /crm/leads/:username/tags - Add tag metadata
router.post("/leads/:username/tags", async (req, res, next) => {
  try {
    const { username } = req.params;
    const { tag } = req.body;

    if (!username || !tag) {
      res.status(400).json({ error: "username and tag are required" });
      return;
    }

    const normalizedUser = username.toLowerCase().trim();
    const pipeline = await LeadPipeline.findOne({ username: normalizedUser });
    if (!pipeline) {
      res.status(404).json({ error: "Lead pipeline not found" });
      return;
    }

    const trimmedTag = String(tag).trim();
    if (trimmedTag && !pipeline.tags.includes(trimmedTag)) {
      pipeline.tags.push(trimmedTag);
      pipeline.lastActivityAt = new Date();
      await pipeline.save();
    }

    res.json(pipeline);
  } catch (error) {
    next(error);
  }
});

export default router;
