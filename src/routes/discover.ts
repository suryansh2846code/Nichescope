import { Router } from "express";
// import {
//   DISCOVER_HASHTAG_JOB_NAME,
//   discoveryQueue,
//   type DiscoveryJobData,
// } from "../queues/discoveryQueue";
// import { HashtagDiscovery } from "../models/HashtagDiscovery";
import { SeedInfluencer } from "../models/SeedInfluencer";
import {
  influencerDiscoveryQueue,
  INFLUENCER_DISCOVER_JOB_NAME,
} from "../queues/commentQueues";

const router = Router();

// router.post("/hashtag", async (req, res, next) => {
//   try {
//     console.log("[DISCOVERY REQUEST]", req.body);
//     const { hashtag } = req.body as Partial<DiscoveryJobData>;
// 
//     if (!hashtag || typeof hashtag !== "string") {
//       res.status(400).json({ error: "hashtag is required" });
//       return;
//     }
// 
//     const cleanHashtag = hashtag.replace(/^#/, "").trim().toLowerCase();
// 
//     // Drain discovery queue to avoid queue backlog
//     await discoveryQueue.drain(true);
// 
//     const payload = { hashtag: cleanHashtag };
//     console.log("[QUEUE PAYLOAD]", payload);
// 
//     const jobId = `discover-${cleanHashtag}-${Date.now()}`;
// 
//     const job = await discoveryQueue.add(
//       DISCOVER_HASHTAG_JOB_NAME,
//       payload,
//       { jobId }
//     );
// 
//     res.status(202).json({
//       jobId: job.id,
//       status: "queued",
//     });
//   } catch (error) {
//     next(error);
//   }
// });
// 
// router.get("/hashtag/:hashtag", async (req, res, next) => {
//   try {
//     const { hashtag } = req.params;
// 
//     if (!hashtag) {
//       res.status(400).json({ error: "hashtag is required" });
//       return;
//     }
// 
//     const keywords = hashtag
//       .split(/[\s,+#]+/)
//       .map(k => k.trim().toLowerCase())
//       .filter(Boolean);
// 
//     const discoveries = await HashtagDiscovery.find(
//       { hashtag: { $in: keywords } },
//       { username: 1, _id: 0 }
//     );
// 
//     res.json(discoveries);
//   } catch (error) {
//     next(error);
//   }
// });

// GET /discover/influencers
router.get("/influencers", async (req, res, next) => {
  try {
    const influencers = await SeedInfluencer.find().sort({ createdAt: -1 });
    res.json(influencers);
  } catch (error) {
    next(error);
  }
});

// POST /discover/influencers
router.post("/influencers", async (req, res, next) => {
  try {
    const { username, niche } = req.body;
    if (!username || !niche) {
      res.status(400).json({ error: "username and niche are required" });
      return;
    }

    const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
    const cleanNiche = niche.trim().toLowerCase();

    const influencer = await SeedInfluencer.findOneAndUpdate(
      { username: cleanUsername },
      { username: cleanUsername, niche: cleanNiche, isActive: true },
      { upsert: true, new: true }
    );

    res.status(201).json(influencer);
  } catch (error) {
    next(error);
  }
});

// PATCH /discover/influencers/:username/toggle
router.patch("/influencers/:username/toggle", async (req, res, next) => {
  try {
    const { username } = req.params;
    const influencer = await SeedInfluencer.findOne({ username: username.toLowerCase() });
    if (!influencer) {
      res.status(404).json({ error: "Influencer not found" });
      return;
    }

    influencer.isActive = !influencer.isActive;
    await influencer.save();

    res.json(influencer);
  } catch (error) {
    next(error);
  }
});

// DELETE /discover/influencers/:username
router.delete("/discover/influencers/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    const result = await SeedInfluencer.deleteOne({ username: username.toLowerCase() });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Influencer not found" });
      return;
    }
    res.json({ message: "Influencer deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// POST /discover/influencers/trigger
router.post("/influencers/trigger", async (req, res, next) => {
  try {
    const jobId = `discover-influencers-${Date.now()}`;
    const job = await influencerDiscoveryQueue.add(
      INFLUENCER_DISCOVER_JOB_NAME,
      {},
      { jobId }
    );

    res.status(202).json({
      jobId: job.id,
      status: "queued",
      message: "Seed influencer post discovery triggered successfully"
    });
  } catch (error) {
    next(error);
  }
});

export default router;
