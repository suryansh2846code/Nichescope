import { Router } from "express";
import { scrapeQueue } from "../queues/scrapeQueue";
import { discoveryQueue } from "../queues/discoveryQueue";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = 50;

    const [discoveryJobs, scrapeJobs] = await Promise.all([
      discoveryQueue.getJobs(["active", "waiting", "completed", "failed", "delayed", "paused"], 0, limit, false),
      scrapeQueue.getJobs(["active", "waiting", "completed", "failed", "delayed", "paused"], 0, limit, false)
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

    const [formattedDiscovery, formattedScrape] = await Promise.all([
      Promise.all(discoveryJobs.map(j => formatJob(j, "discovery"))),
      Promise.all(scrapeJobs.map(j => formatJob(j, "scrape")))
    ]);

    const allJobs = [...formattedDiscovery, ...formattedScrape].sort((a, b) => b.timestamp - a.timestamp);

    res.json(allJobs);
  } catch (error) {
    next(error);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    const [
      discWaiting, discActive, discCompleted, discFailed,
      scrapeWaiting, scrapeActive, scrapeCompleted, scrapeFailed
    ] = await Promise.all([
      discoveryQueue.getWaitingCount(),
      discoveryQueue.getActiveCount(),
      discoveryQueue.getCompletedCount(),
      discoveryQueue.getFailedCount(),
      scrapeQueue.getWaitingCount(),
      scrapeQueue.getActiveCount(),
      scrapeQueue.getCompletedCount(),
      scrapeQueue.getFailedCount()
    ]);

    res.json({
      waiting: discWaiting + scrapeWaiting,
      active: discActive + scrapeActive,
      completed: discCompleted + scrapeCompleted,
      failed: discFailed + scrapeFailed
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
      if (!job) {
        job = await scrapeQueue.getJob(id);
      }
    } else {
      job = await scrapeQueue.getJob(id);
      if (!job) {
        job = await discoveryQueue.getJob(id);
      }
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
