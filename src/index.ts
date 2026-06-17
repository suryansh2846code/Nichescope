import express from "express";
import { connectToDatabase } from "./db";
import jobsRouter from "./routes/jobs";
import leadsRouter from "./routes/leads";
import scrapeRouter from "./routes/scrape";
import discoverRouter from "./routes/discover";
import analysisRouter from "./routes/analysis";
import usersRouter from "./routes/users";
import searchRouter from "./routes/search";
import { startMonitoringScheduler } from "./services/trends/scheduler";
import monitoringRouter from "./routes/monitoring";
import crmRouter from "./routes/crm";
import devRouter from "./routes/dev";
import logsRouter from "./routes/logs";

const app = express();
const port = process.env.PORT || 3001;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json());

// Root endpoint GET /
app.get("/", (req, res) => {
  res.json({
    name: "NicheScope API",
    version: "1.0",
    status: "running"
  });
});

// Health check GET /health
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime()
  });
});

// Mount routes with explicit console logs
console.log("Mounted /leads routes");
app.use("/leads", leadsRouter);

console.log("Mounted /scrape routes");
app.use("/scrape", scrapeRouter);

console.log("Mounted /jobs routes");
app.use("/jobs", jobsRouter);

console.log("Mounted /discover routes");
app.use("/discover", discoverRouter);

console.log("Mounted /analysis routes");
app.use("/analysis", analysisRouter);

console.log("Mounted /users routes");
app.use("/users", usersRouter);

console.log("Mounted /search routes");
app.use("/search", searchRouter);

console.log("Mounted /monitoring routes");
app.use("/monitoring", monitoringRouter);

console.log("Mounted /crm routes");
app.use("/crm", crmRouter);

console.log("Mounted /dev routes");
app.use("/dev", devRouter);

console.log("Mounted /logs routes");
app.use("/logs", logsRouter);

console.log("Routes Registered");

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof Error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
});

// Start Express server and connect to database asynchronously
app.listen(port, () => {
  console.log(`Server Running at http://localhost:${port}`);
  console.log(`Listening on ${port}`);

  connectToDatabase()
    .then(() => {
      console.log("Mongo Connected");
      startMonitoringScheduler();
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown startup error";
      console.error(`Failed to connect to MongoDB: ${message}`);
    });
});

export default app;
