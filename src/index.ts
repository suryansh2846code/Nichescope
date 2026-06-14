import express from "express";
import { connectToDatabase } from "./db";
import jobsRouter from "./routes/jobs";
import leadsRouter from "./routes/leads";
import scrapeRouter from "./routes/scrape";
import discoverRouter from "./routes/discover";
import analysisRouter from "./routes/analysis";
import usersRouter from "./routes/users";

const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/leads", leadsRouter);
app.use("/scrape", scrapeRouter);
app.use("/jobs", jobsRouter);
app.use("/discover", discoverRouter);
app.use("/analysis", analysisRouter);
app.use("/users", usersRouter);

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

try {
  await connectToDatabase();

  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown startup error";

  console.error(`Failed to start server: ${message}`);
  process.exit(1);
}

export default app;
