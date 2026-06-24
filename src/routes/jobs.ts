import { Router } from "express";
import { scrapeQueue } from "../queues/scrapeQueue";
import { discoveryQueue } from "../queues/discoveryQueue";
import { influencerDiscoveryQueue, commentScrapeQueue, commentAnalysisQueue } from "../queues/commentQueues";
import { leadQualificationQueue } from "../queues/leadQualificationQueue";
import { userIntelligenceQueue } from "../queues/userIntelligenceQueue";
import { embeddingQueue } from "../queues/embeddingQueue";
import { analysisQueue } from "../queues/analysisQueue";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = 50;

    // Original job fetching:
    // const [discoveryJobs, scrapeJobs] = await Promise.all([
    //   discoveryQueue.getJobs(["active", "waiting", "completed", "failed", "delayed", "paused"], 0, limit, false),
    //   scrapeQueue.getJobs(["active", "waiting", "completed", "failed", "delayed", "paused"], 0, limit, false)
    // ]);
    const [discoveryJobs, scrapeJobs, influencerJobs, commScrapeJobs, commAnalysisJobs] = await Promise.all([
      discoveryQueue.getJobs(["active", "waiting", "completed", "failed", "delayed", "paused"], 0, limit, false),
      scrapeQueue.getJobs(["active", "waiting", "completed", "failed", "delayed", "paused"], 0, limit, false),
      influencerDiscoveryQueue.getJobs(["active", "waiting", "completed", "failed", "delayed", "paused"], 0, limit, false),
      commentScrapeQueue.getJobs(["active", "waiting", "completed", "failed", "delayed", "paused"], 0, limit, false),
      commentAnalysisQueue.getJobs(["active", "waiting", "completed", "failed", "delayed", "paused"], 0, limit, false)
    ]);

    const formatJob = async (job: any, queueName: string) => {
      let state = "unknown";
      try {
        state = await job.getState();
      } catch (err) {
        // getState can throw if job is deleted mid-flight
      }
      return {
        id: job.id,
        name: job.name,
        queue: queueName,
        state,
        progress: job.progress,
        data: job.data,
        timestamp: job.timestamp,
        failedReason: job.failedReason,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn
      };
    };

    // Original formatting:
    // const [formattedDiscovery, formattedScrape] = await Promise.all([
    //   Promise.all(discoveryJobs.map(j => formatJob(j, "discovery"))),
    //   Promise.all(scrapeJobs.map(j => formatJob(j, "scrape")))
    // ]);
    // const allJobs = [...formattedDiscovery, ...formattedScrape].sort((a, b) => b.timestamp - a.timestamp);
    const [formattedDiscovery, formattedScrape, formattedInfluencer, formattedCommScrape, formattedCommAnalysis] = await Promise.all([
      Promise.all(discoveryJobs.map(j => formatJob(j, "discovery"))),
      Promise.all(scrapeJobs.map(j => formatJob(j, "scrape"))),
      Promise.all(influencerJobs.map(j => formatJob(j, "influencer-discovery"))),
      Promise.all(commScrapeJobs.map(j => formatJob(j, "comment-scrape"))),
      Promise.all(commAnalysisJobs.map(j => formatJob(j, "comment-analysis")))
    ]);

    const allJobs = [
      ...formattedDiscovery,
      ...formattedScrape,
      ...formattedInfluencer,
      ...formattedCommScrape,
      ...formattedCommAnalysis
    ].sort((a, b) => b.timestamp - a.timestamp);

    res.json(allJobs);
  } catch (error) {
    next(error);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    // Original stats:
    // const [
    //   discWaiting, discActive, discCompleted, discFailed,
    //   scrapeWaiting, scrapeActive, scrapeCompleted, scrapeFailed
    // ] = await Promise.all([
    //   discoveryQueue.getWaitingCount(),
    //   discoveryQueue.getActiveCount(),
    //   discoveryQueue.getCompletedCount(),
    //   discoveryQueue.getFailedCount(),
    //   scrapeQueue.getWaitingCount(),
    //   scrapeQueue.getActiveCount(),
    //   scrapeQueue.getCompletedCount(),
    //   scrapeQueue.getFailedCount()
    // ]);
    //
    // res.json({
    //   waiting: discWaiting + scrapeWaiting,
    //   active: discActive + scrapeActive,
    //   completed: discCompleted + scrapeCompleted,
    //   failed: discFailed + scrapeFailed
    // });
    const [
      discWaiting, discActive, discCompleted, discFailed,
      scrapeWaiting, scrapeActive, scrapeCompleted, scrapeFailed,
      infWaiting, infActive, infCompleted, infFailed,
      cScrapeWaiting, cScrapeActive, cScrapeCompleted, cScrapeFailed,
      cAnalWaiting, cAnalActive, cAnalCompleted, cAnalFailed,
      qualWaiting, qualActive, qualCompleted, qualFailed,
      intelWaiting, intelActive, intelCompleted, intelFailed,
      embedWaiting, embedActive, embedCompleted, embedFailed,
      analWaiting, analActive, analCompleted, analFailed
    ] = await Promise.all([
      discoveryQueue.getWaitingCount(), discoveryQueue.getActiveCount(), discoveryQueue.getCompletedCount(), discoveryQueue.getFailedCount(),
      scrapeQueue.getWaitingCount(), scrapeQueue.getActiveCount(), scrapeQueue.getCompletedCount(), scrapeQueue.getFailedCount(),
      influencerDiscoveryQueue.getWaitingCount(), influencerDiscoveryQueue.getActiveCount(), influencerDiscoveryQueue.getCompletedCount(), influencerDiscoveryQueue.getFailedCount(),
      commentScrapeQueue.getWaitingCount(), commentScrapeQueue.getActiveCount(), commentScrapeQueue.getCompletedCount(), commentScrapeQueue.getFailedCount(),
      commentAnalysisQueue.getWaitingCount(), commentAnalysisQueue.getActiveCount(), commentAnalysisQueue.getCompletedCount(), commentAnalysisQueue.getFailedCount(),
      leadQualificationQueue.getWaitingCount(), leadQualificationQueue.getActiveCount(), leadQualificationQueue.getCompletedCount(), leadQualificationQueue.getFailedCount(),
      userIntelligenceQueue.getWaitingCount(), userIntelligenceQueue.getActiveCount(), userIntelligenceQueue.getCompletedCount(), userIntelligenceQueue.getFailedCount(),
      embeddingQueue.getWaitingCount(), embeddingQueue.getActiveCount(), embeddingQueue.getCompletedCount(), embeddingQueue.getFailedCount(),
      analysisQueue.getWaitingCount(), analysisQueue.getActiveCount(), analysisQueue.getCompletedCount(), analysisQueue.getFailedCount()
    ]);

    res.json({
      waiting: discWaiting + scrapeWaiting + infWaiting + cScrapeWaiting + cAnalWaiting + qualWaiting + intelWaiting + embedWaiting + analWaiting,
      active: discActive + scrapeActive + infActive + cScrapeActive + cAnalActive + qualActive + intelActive + embedActive + analActive,
      completed: discCompleted + scrapeCompleted + infCompleted + cScrapeCompleted + cAnalCompleted + qualCompleted + intelCompleted + embedCompleted + analCompleted,
      failed: discFailed + scrapeFailed + infFailed + cScrapeFailed + cAnalFailed + qualFailed + intelFailed + embedFailed + analFailed,
      breakdown: {
        discovery: { waiting: discWaiting, active: discActive },
        profileScrape: { waiting: scrapeWaiting, active: scrapeActive },
        influencerDiscovery: { waiting: infWaiting, active: infActive },
        commentScrape: { waiting: cScrapeWaiting, active: cScrapeActive },
        commentAnalysis: { waiting: cAnalWaiting, active: cAnalActive },
        qualification: { waiting: qualWaiting, active: qualActive },
        intelligence: { waiting: intelWaiting, active: intelActive },
        embedding: { waiting: embedWaiting, active: embedActive },
        postAnalysis: { waiting: analWaiting, active: analActive }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: "job id is required" });
      return;
    }

    let job: any = null;
    if (id.startsWith("discover-")) {
      job = await discoveryQueue.getJob(id);
      if (!job) job = await influencerDiscoveryQueue.getJob(id);
      if (!job) job = await scrapeQueue.getJob(id);
    } else if (id.startsWith("comments-")) {
      job = await commentScrapeQueue.getJob(id);
    } else if (id.startsWith("analyze-")) {
      job = await commentAnalysisQueue.getJob(id);
    } else {
      job = await scrapeQueue.getJob(id);
      if (!job) job = await discoveryQueue.getJob(id);
      if (!job) job = await influencerDiscoveryQueue.getJob(id);
      if (!job) job = await commentScrapeQueue.getJob(id);
      if (!job) job = await commentAnalysisQueue.getJob(id);
    }

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const state = await job.getState();

    res.json({
      id: job.id,
      name: job.name,
      state,
      progress: job.progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
