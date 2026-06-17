import { connectToDatabase } from "../src/db";
import { WorkerLog } from "../src/models/WorkerLog";
import { scrapeQueue } from "../src/queues/scrapeQueue";

await connectToDatabase();

// Clear any existing logs
await WorkerLog.deleteMany({});
console.log("Cleared logs database.");

// Add a mock job
const jobId = `scrape-test-${Date.now()}`;
console.log(`Enqueuing mock success job: ${jobId}`);
await scrapeQueue.add(
  "scrape-profile",
  {
    username: "test_logger_user",
    niche: "dev-test",
    testScenario: "success",
  },
  { jobId }
);

// Wait for job to finish and logs to populate
console.log("Waiting for job to be processed by the scrape worker...");
await new Promise(r => setTimeout(r, 5000));

// Query logs
const logs = await WorkerLog.find({ workerName: "scraper" }).sort({ timestamp: 1 });
console.log(`Retrieved ${logs.length} logs for scraper:`);
for (const log of logs) {
  console.log(`[${log.timestamp.toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}`);
}

// Check the HTTP API endpoint
console.log("\nTesting API HTTP GET /logs/scraper...");
const res = await fetch("http://localhost:3001/logs/scraper");
if (res.ok) {
  const data = await res.json() as any[];
  console.log(`API returned ${data.length} logs successfully!`);
} else {
  console.error("API request failed:", res.statusText);
}

process.exit(0);
