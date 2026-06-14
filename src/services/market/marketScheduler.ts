import { MarketSnapshot } from "../../models/MarketSnapshot";
import { marketIntelligenceQueue, AGGREGATE_MARKET_JOB_NAME } from "../../queues/marketIntelligenceQueue";

let schedulerInterval: Timer | null = null;

/**
 * Checks if a market snapshot is due and enqueues a job if so.
 */
export async function runMarketCycle() {
  console.log("Starting Market Intelligence snapshot scheduler cycle...");
  try {
    const intervalHours = Number(process.env.MARKET_SNAPSHOT_INTERVAL_HOURS || 24);
    const intervalMs = intervalHours * 60 * 60 * 1000;

    const latestSnapshot = await MarketSnapshot.findOne().sort({ snapshotDate: -1 });

    const now = Date.now();
    let isDue = false;

    if (!latestSnapshot) {
      console.log("No market snapshots found. Running initial market snapshot job immediately.");
      isDue = true;
    } else {
      const lastRun = new Date(latestSnapshot.snapshotDate).getTime();
      if (now - lastRun >= intervalMs) {
        console.log(`Last market snapshot was at ${latestSnapshot.snapshotDate.toISOString()}, which is older than ${intervalHours} hours. Running snapshot job.`);
        isDue = true;
      } else {
        const hoursRemaining = ((intervalMs - (now - lastRun)) / (60 * 60 * 1000)).toFixed(1);
        console.log(`Market snapshot is not due yet. Next run in ${hoursRemaining} hours.`);
      }
    }

    if (isDue) {
      await marketIntelligenceQueue.add(
        AGGREGATE_MARKET_JOB_NAME,
        { timestamp: new Date().toISOString() },
        { jobId: `market-snapshot-${Math.floor(now / intervalMs)}` } // Deduplicate snapshot jobs within the interval window
      );
      console.log("Enqueued new Market Intelligence snapshot job.");
    }
  } catch (err) {
    console.error("Failed during market snapshot scheduler cycle:", err);
  }
}

/**
 * Starts the periodic market snapshot scheduler.
 */
export function startMarketScheduler() {
  const intervalHours = Number(process.env.MARKET_SNAPSHOT_INTERVAL_HOURS || 24);
  // We check if it is due every 5 minutes to be responsive without overloading Redis
  const checkIntervalMs = 5 * 60 * 1000;

  console.log(`Initializing Market Snapshot scheduler. Snapshots run every ${intervalHours} hours.`);

  // Execute check immediately on startup
  runMarketCycle();

  // Start interval timer
  schedulerInterval = setInterval(() => {
    runMarketCycle();
  }, checkIntervalMs);
}

/**
 * Stops the periodic market scheduler.
 */
export function stopMarketScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("Stopped Market Snapshot scheduler.");
  }
}
