import { Router } from "express";
import { scrapeQueue } from "../queues/scrapeQueue";
import { discoveryQueue } from "../queues/discoveryQueue";
import { analysisQueue } from "../queues/analysisQueue";
import { embeddingQueue } from "../queues/embeddingQueue";
import { leadQualificationQueue } from "../queues/leadQualificationQueue";
import { monitoringQueue } from "../queues/monitoringQueue";
import { userIntelligenceQueue } from "../queues/userIntelligenceQueue";

const router = Router();

router.post("/clear-queues", async (req, res, next) => {
  try {
    await Promise.all([
      scrapeQueue.obliterate({ force: true }),
      discoveryQueue.obliterate({ force: true }),
      analysisQueue.obliterate({ force: true }),
      embeddingQueue.obliterate({ force: true }),
      leadQualificationQueue.obliterate({ force: true }),
      monitoringQueue.obliterate({ force: true }),
      userIntelligenceQueue.obliterate({ force: true }),
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

export default router;
