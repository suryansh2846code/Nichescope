import { Router } from "express";
import {
  SCRAPE_PROFILE_JOB_NAME,
  scrapeQueue,
  type ScrapeJobData,
} from "../queues/scrapeQueue";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { username, niche, maxFollowers } = req.body as Partial<ScrapeJobData>;

    if (!username || typeof username !== "string") {
      res.status(400).json({ error: "username is required" });
      return;
    }

    const targetNiche = typeof niche === "string" && niche.trim() !== "" ? niche.trim() : "general";
    const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
    const jobId = `scrape-${cleanUsername}-${Date.now()}`;

    const job = await scrapeQueue.add(
      SCRAPE_PROFILE_JOB_NAME,
      {
        username: username.replace(/^@/, "").trim(),
        niche: targetNiche,
        maxFollowers:
          typeof maxFollowers === "number" && maxFollowers > 0
            ? maxFollowers
            : undefined,
      },
      { jobId }
    );

    res.status(202).json({
      jobId: job.id,
      status: "queued",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
