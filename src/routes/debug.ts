import { Router } from "express";
import { scrapeQueue } from "../queues/scrapeQueue";
import { discoveryQueue } from "../queues/discoveryQueue";

const router = Router();

router.get("/active-jobs", async (req, res, next) => {
  try {
    const [scrapeJobs, discoveryJobs] = await Promise.all([
      scrapeQueue.getJobs(["active"]),
      discoveryQueue.getJobs(["active"])
    ]);

    const active = [...scrapeJobs, ...discoveryJobs].map(job => {
      const processedOn = job.processedOn || job.timestamp;
      const elapsedSeconds = processedOn ? Math.round((Date.now() - processedOn) / 1000) : 0;
      
      let stage = "Working";
      let progressVal = 0;
      if (job.progress) {
        if (typeof job.progress === "object" && job.progress !== null) {
          stage = job.progress.stage || "Working";
          progressVal = job.progress.percent || 0;
        } else if (typeof job.progress === "number") {
          progressVal = job.progress;
        } else if (typeof job.progress === "string") {
          stage = job.progress;
        }
      }

      return {
        id: job.id,
        username: job.data.username || job.data.hashtag || "unknown",
        progress: progressVal,
        stage: stage,
        startedAt: processedOn ? new Date(processedOn).toISOString() : new Date().toISOString(),
        elapsedSeconds: elapsedSeconds
      };
    });

    res.json(active);
  } catch (err) {
    next(err);
  }
});

export default router;
