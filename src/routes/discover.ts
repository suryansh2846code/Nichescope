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
    console.log("[DISCOVERY REQUEST]", req.body);
    const { hashtag } = req.body as Partial<DiscoveryJobData>;

    if (!hashtag || typeof hashtag !== "string") {
      res.status(400).json({ error: "hashtag is required" });
      return;
    }

    const cleanHashtag = hashtag.replace(/^#/, "").trim().toLowerCase();

    // Drain discovery queue to avoid queue backlog
    await discoveryQueue.drain(true);

    const payload = { hashtag: cleanHashtag };
    console.log("[QUEUE PAYLOAD]", payload);

    const jobId = `discover-${cleanHashtag}-${Date.now()}`;

    const job = await discoveryQueue.add(
      DISCOVER_HASHTAG_JOB_NAME,
      payload,
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

router.get("/hashtag/:hashtag", async (req, res, next) => {
  try {
    const { hashtag } = req.params;

    if (!hashtag) {
      res.status(400).json({ error: "hashtag is required" });
      return;
    }

    const keywords = hashtag
      .split(/[\s,+#]+/)
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    const discoveries = await HashtagDiscovery.find(
      { hashtag: { $in: keywords } },
      { username: 1, _id: 0 }
    );

    res.json(discoveries);
  } catch (error) {
    next(error);
  }
});

export default router;
