import { Router } from "express";
import { scrapeQueue } from "../queues/scrapeQueue";
import { discoveryQueue } from "../queues/discoveryQueue";

const router = Router();

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
