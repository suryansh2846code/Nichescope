import { Router } from "express";
import { WorkerLog } from "../models/WorkerLog";

const router = Router();

router.get("/:workerName", async (req, res, next) => {
  try {
    const { workerName } = req.params;
    const limit = Number(req.query.limit) || 100;

    const logs = await WorkerLog.find({ workerName })
      .sort({ timestamp: -1 })
      .limit(limit);

    // Reverse to return them in chronological order (oldest first)
    res.json(logs.reverse());
  } catch (error) {
    next(error);
  }
});

router.post("/clear/:workerName", async (req, res, next) => {
  try {
    const { workerName } = req.params;
    await WorkerLog.deleteMany({ workerName });
    res.json({ message: `Logs for worker "${workerName}" cleared successfully` });
  } catch (error) {
    next(error);
  }
});

export default router;
