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
import { DiscoverySession } from "../models/DiscoverySession";
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
        let commentsCount = 0;
        if (postUrls.length > 0) {
          const uniqueCommenters = await CommentAnalysis.distinct("username", {
            postUrl: { $in: postUrls },
            isLead: true
          });
          leadsCount = uniqueCommenters.length;
          commentsCount = await CommentAnalysis.countDocuments({
            postUrl: { $in: postUrls }
          });
        }

        return {
          ...inf.toObject(),
          leadsCount,
          postsCount: posts.length,
          commentsCount
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
router.delete("/influencers/:username", async (req, res, next) => {
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
    if (influencer) {
      influencer.isProcessed = false;
      influencer.isActive = true;
      await influencer.save();
    }
    const niche = influencer?.niche || "fitness";

    const sessionId = `run-${cleanUsername}-${Date.now()}`;

    // Initialize DiscoverySession in database
    await DiscoverySession.create({
      sessionId,
      username: cleanUsername,
      niche,
      status: "running",
      stats: {
        postsFound: 0,
        commentsExtracted: 0,
        commentsQualified: 0,
        leadsCreated: 0
      },
      events: [],
      startedAt: new Date()
    });

    const job = await influencerDiscoveryQueue.add(
      INFLUENCER_DISCOVER_JOB_NAME,
      {
        username: cleanUsername,
        niche,
        sessionId
      },
      { jobId: sessionId }
    );

    res.status(202).json({
      jobId: job.id,
      sessionId,
      status: "queued",
      message: `Influencer post discovery triggered for @${cleanUsername}`
    });
  } catch (error) {
    next(error);
  }
});

// POST /discover/run-niche-scan
router.post("/run-niche-scan", async (req, res, next) => {
  try {
    const { niche, usernames } = req.body;
    if (!niche || typeof niche !== "string" || niche.trim() === "") {
      res.status(400).json({ error: "niche parameter is required and must be a non-empty string" });
      return;
    }
    if (!Array.isArray(usernames)) {
      res.status(400).json({ error: "usernames parameter is required and must be an array" });
      return;
    }

    const cleanNiche = niche.trim().toLowerCase();
    const cleanedUsernames = usernames
      .map(u => (u || "").replace(/^@/, "").trim().toLowerCase())
      .filter(Boolean);

    const count = cleanedUsernames.length;

    // Validate size: 1 to 5
    if (count === 0) {
      res.status(400).json({
        error: "At least 1 seed influencer is required to start the scan."
      });
      return;
    }

    if (count > 5) {
      res.status(400).json({
        error: "You can run a scan for a maximum of 5 influencers at a time."
      });
      return;
    }

    const spawnedRuns = [];
    const timestamp = Date.now();

    // Clean up any zombie/stale jobs for these usernames before starting fresh
    for (const username of cleanedUsernames) {
      const zombieJobId = `run-${username}`;
      try {
        // Try to remove any waiting/delayed job with a matching prefix
        const existingJob = await influencerDiscoveryQueue.getJob(zombieJobId);
        if (existingJob) {
          const state = await existingJob.getState();
          if (state === "active" || state === "waiting" || state === "delayed") {
            await existingJob.remove();
            console.log(`[Cleanup] Removed stale ${state} job ${zombieJobId}`);
          }
        }
      } catch (cleanupErr) {
        // Non-fatal — best effort cleanup
        console.warn(`[Cleanup] Could not remove stale job for ${username}:`, cleanupErr);
      }
    }

    for (const username of cleanedUsernames) {
      // Upsert into SeedInfluencer to register this influencer under the niche
      await SeedInfluencer.findOneAndUpdate(
        { username },
        { username, niche: cleanNiche, isActive: true, isProcessed: false },
        { upsert: true, returnDocument: "after" }
      );

      const sessionId = `run-${username}-${timestamp}`;

      // Initialize DiscoverySession in database
      await DiscoverySession.create({
        sessionId,
        username,
        niche: cleanNiche,
        status: "running",
        stats: {
          postsFound: 0,
          commentsExtracted: 0,
          commentsQualified: 0,
          leadsCreated: 0
        },
        events: [],
        startedAt: new Date()
      });

      // Add to discovery queue
      const job = await influencerDiscoveryQueue.add(
        INFLUENCER_DISCOVER_JOB_NAME,
        {
          username,
          niche: cleanNiche,
          sessionId
        },
        {
          jobId: sessionId,
          removeOnComplete: { count: 5 },  // keep only last 5 completed
          removeOnFail: { count: 10 },     // keep last 10 failed for debugging
        }
      );

      spawnedRuns.push({
        username,
        sessionId,
        jobId: job.id
      });
    }

    res.status(202).json({
      message: `Niche scan process started for "${niche}" with ${count} influencers.`,
      runs: spawnedRuns
    });
  } catch (error) {
    next(error);
  }
});

// POST /discover/sessions/:sessionId/pause
router.post("/sessions/:sessionId/pause", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await DiscoverySession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.status !== "running") {
      res.status(400).json({ error: `Cannot pause session in state: ${session.status}` });
      return;
    }

    const { discoveryEmitter } = await import("../services/discovery/discoveryEventEmitter");
    await discoveryEmitter.emit(sessionId, "paused", { message: "Session paused" });

    res.json({ message: "Session paused successfully" });
  } catch (error) {
    next(error);
  }
});

// POST /discover/sessions/:sessionId/resume
router.post("/sessions/:sessionId/resume", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await DiscoverySession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.status !== "paused") {
      res.status(400).json({ error: `Cannot resume session in state: ${session.status}` });
      return;
    }

    const { discoveryEmitter } = await import("../services/discovery/discoveryEventEmitter");
    await discoveryEmitter.emit(sessionId, "resumed", { message: "Session resumed" });

    res.json({ message: "Session resumed successfully" });
  } catch (error) {
    next(error);
  }
});

// POST /discover/sessions/:sessionId/cancel
router.post("/sessions/:sessionId/cancel", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await DiscoverySession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.status === "completed" || session.status === "failed" || session.status === "cancelled") {
      res.status(400).json({ error: `Cannot cancel session in state: ${session.status}` });
      return;
    }

    const { discoveryEmitter } = await import("../services/discovery/discoveryEventEmitter");
    await discoveryEmitter.emit(sessionId, "cancelled", { message: "Session cancelled by user" });

    res.json({ message: "Session cancelled successfully" });
  } catch (error) {
    next(error);
  }
});

// GET /discover/influencers/:username/latest-session
router.get("/influencers/:username/latest-session", async (req, res, next) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
    const session = await DiscoverySession.findOne({ username: cleanUsername }).sort({ startedAt: -1 });
    if (!session) {
      res.status(404).json({ error: "No discovery session found for this influencer" });
      return;
    }
    res.json(session);
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
