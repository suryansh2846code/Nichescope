import { Router } from "express";
import { scrapeQueue } from "../queues/scrapeQueue";
import { discoveryQueue } from "../queues/discoveryQueue";
import { analysisQueue } from "../queues/analysisQueue";
import { embeddingQueue } from "../queues/embeddingQueue";
import { leadQualificationQueue } from "../queues/leadQualificationQueue";
import { monitoringQueue } from "../queues/monitoringQueue";
import { userIntelligenceQueue } from "../queues/userIntelligenceQueue";
import {
  influencerDiscoveryQueue,
  commentScrapeQueue,
  commentAnalysisQueue,
  INFLUENCER_DISCOVER_JOB_NAME,
} from "../queues/commentQueues";
import { SeedInfluencer } from "../models/SeedInfluencer";
import { DiscoverySession } from "../models/DiscoverySession";

const router = Router();

router.post("/clear-queues", async (req, res, next) => {
  try {
    // Original Promise.all call:
    // await Promise.all([
    //   scrapeQueue.obliterate({ force: true }),
    //   discoveryQueue.obliterate({ force: true }),
    //   analysisQueue.obliterate({ force: true }),
    //   embeddingQueue.obliterate({ force: true }),
    //   leadQualificationQueue.obliterate({ force: true }),
    //   monitoringQueue.obliterate({ force: true }),
    //   userIntelligenceQueue.obliterate({ force: true }),
    // ]);
    await Promise.all([
      scrapeQueue.obliterate({ force: true }),
      discoveryQueue.obliterate({ force: true }),
      analysisQueue.obliterate({ force: true }),
      embeddingQueue.obliterate({ force: true }),
      leadQualificationQueue.obliterate({ force: true }),
      monitoringQueue.obliterate({ force: true }),
      userIntelligenceQueue.obliterate({ force: true }),
      influencerDiscoveryQueue.obliterate({ force: true }),
      commentScrapeQueue.obliterate({ force: true }),
      commentAnalysisQueue.obliterate({ force: true }),
    ]);
    res.json({ message: "Queues cleared successfully" });
  } catch (err) {
    next(err);
  }
});

router.post("/trigger-scenario", async (req, res, next) => {
  try {
    const { scenario, username } = req.body;
    if (!scenario || !username) {
      res.status(400).json({ error: "scenario and username are required" });
      return;
    }

    const jobId = `scrape-${username}-${Date.now()}`;
    const job = await scrapeQueue.add(
      "scrape-profile",
      {
        username,
        niche: "dev-test",
        testScenario: scenario
      },
      { jobId }
    );

    res.json({ jobId, message: `Scenario ${scenario} triggered for @${username}` });
  } catch (err) {
    next(err);
  }
});

router.post("/test-influencer-discovery/:scenario", async (req, res, next) => {
  try {
    const { scenario } = req.params;
    const validScenarios = ["influencer-private", "influencer-no-posts", "influencer-success"];
    
    if (!validScenarios.includes(scenario)) {
      res.status(400).json({ error: `Invalid scenario. Valid: ${validScenarios.join(", ")}` });
      return;
    }

    // Ensure the seed influencer exists in the registry, and reset its processed status
    await SeedInfluencer.findOneAndUpdate(
      { username: "test_influencer" },
      { username: "test_influencer", niche: "fitness", isActive: true, isProcessed: false, processedAt: undefined },
      { upsert: true, new: true }
    );
    
    const sessionId = `test-run-${scenario}-${Date.now()}`;

    // Initialize DiscoverySession in database
    await DiscoverySession.create({
      sessionId,
      username: "test_influencer",
      niche: "fitness",
      status: "running",
      stats: {
        postsFound: 0,
        postsScraped: 0,
        commentsExtracted: 0,
        commentsAnalyzed: 0,
        commentsQualified: 0,
        leadsCreated: 0
      },
      events: [],
      startedAt: new Date()
    });

    const job = await influencerDiscoveryQueue.add(
      INFLUENCER_DISCOVER_JOB_NAME,
      {
        username: "test_influencer",
        niche: "fitness",
        testScenario: scenario,
        sessionId
      },
      { jobId: sessionId }
    );
    
    res.json({ 
      jobId: job.id, 
      sessionId,
      message: `Test scenario queued: ${scenario}` 
    });
  } catch (err) {
    next(err);
  }
});

export default router;
