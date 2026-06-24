import { Router } from "express";
// import {
//   DISCOVER_HASHTAG_JOB_NAME,
//   discoveryQueue,
//   type DiscoveryJobData,
// } from "../queues/discoveryQueue";
// import { HashtagDiscovery } from "../models/HashtagDiscovery";
import { SeedInfluencer } from "../models/SeedInfluencer";
import { Post } from "../models/Post";
import { CommentAnalysis } from "../models/CommentAnalysis";
import { LeadQualification } from "../models/LeadQualification";
import {
  influencerDiscoveryQueue,
  INFLUENCER_DISCOVER_JOB_NAME,
} from "../queues/commentQueues";

const router = Router();

// router.post("/hashtag", async (req, res, next) => {
//   ... (rest of the unused router.post and router.get)
// })

// GET /discover/influencers
router.get("/influencers", async (req, res, next) => {
  try {
    const influencers = await SeedInfluencer.find().sort({ createdAt: -1 });
    
    const enrichedInfluencers = await Promise.all(
      influencers.map(async (inf) => {
        const posts = await Post.find({ username: new RegExp(`^${inf.username}$`, "i") });
        const postUrls = posts.map(p => p.postUrl).filter(Boolean);
        
        let leadsCount = 0;
        if (postUrls.length > 0) {
          const uniqueCommenters = await CommentAnalysis.distinct("username", {
            postUrl: { $in: postUrls },
            isLead: true
          });
          leadsCount = uniqueCommenters.length;
        }
        
        return {
          ...inf.toObject(),
          leadsCount
        };
      })
    );

    res.json(enrichedInfluencers);
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

// POST /discover/influencers/:username/run
router.post("/influencers/:username/run", async (req, res, next) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
    
    const influencer = await SeedInfluencer.findOne({ username: cleanUsername });
    const niche = influencer?.niche || "fitness";

    const jobId = `discover-${cleanUsername}-${Date.now()}`;
    const job = await influencerDiscoveryQueue.add(
      INFLUENCER_DISCOVER_JOB_NAME,
      {
        username: cleanUsername,
        niche
      },
      { jobId }
    );

    res.status(202).json({
      jobId: job.id,
      status: "queued",
      message: `Influencer post discovery triggered for @${cleanUsername}`
    });
  } catch (error) {
    next(error);
  }
});

// GET /discover/influencers/:username/leads
router.get("/influencers/:username/leads", async (req, res, next) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
    
    const posts = await Post.find({ username: new RegExp(`^${cleanUsername}$`, "i") });
    const postUrls = posts.map(p => p.postUrl).filter(Boolean);
    
    if (postUrls.length === 0) {
      res.json([]);
      return;
    }
    
    // Find all comment analyses on this influencer's posts that are leads
    const comments = await CommentAnalysis.find({
      postUrl: { $in: postUrls },
      isLead: true
    }).sort({ analyzedAt: -1 });
    
    // Map comments to their corresponding LeadQualification data
    const leadsData = await Promise.all(
      comments.map(async (comment) => {
        const qualification = await LeadQualification.findOne({
          username: comment.username.toLowerCase()
        });
        
        return {
          username: comment.username,
          commentText: comment.commentText,
          postUrl: comment.postUrl,
          intentScore: comment.intentScore,
          niche: comment.niche,
          analyzedAt: comment.analyzedAt,
          qualification: qualification || null
        };
      })
    );
    
    res.json(leadsData);
  } catch (error) {
    next(error);
  }
});

export default router;
