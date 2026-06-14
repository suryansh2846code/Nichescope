import { Router } from "express";
import {
  DISCOVER_HASHTAG_JOB_NAME,
  discoveryQueue,
  type DiscoveryJobData,
} from "../queues/discoveryQueue";
import { HashtagDiscovery } from "../models/HashtagDiscovery";

const router = Router();

router.post("/hashtag", async (req, res, next) => {
  try {
    const { hashtag } = req.body as Partial<DiscoveryJobData>;

    if (!hashtag || typeof hashtag !== "string") {
      res.status(400).json({ error: "hashtag is required" });
      return;
    }

    const cleanHashtag = hashtag.replace(/^#/, "").trim().toLowerCase();

    const job = await discoveryQueue.add(DISCOVER_HASHTAG_JOB_NAME, {
      hashtag: cleanHashtag,
    });

    res.status(202).json({
      jobId: job.id,
      status: "queued",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/hashtag/:hashtag", async (req, res, next) => {
  try {
    const { hashtag } = req.params;

    if (!hashtag) {
      res.status(400).json({ error: "hashtag is required" });
      return;
    }

    const cleanHashtag = hashtag.replace(/^#/, "").trim().toLowerCase();

    const discoveries = await HashtagDiscovery.find(
      { hashtag: cleanHashtag },
      { username: 1, _id: 0 }
    );

    res.json(discoveries);
  } catch (error) {
    next(error);
  }
});

export default router;
