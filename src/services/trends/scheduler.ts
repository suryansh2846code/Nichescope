import { UserMonitoring } from "../../models/UserMonitoring";
import { monitoringQueue, CHECK_USER_JOB_NAME } from "../../queues/monitoringQueue";

let schedulerInterval: Timer | null = null;

/**
 * Runs a single monitoring check cycle.
 * Iterates through monitored users and enqueues check jobs if the interval has elapsed.
 */
export async function runMonitoringCycle() {
  console.log("Starting lead monitoring scheduler cycle...");
  try {
    const intervalHours = Number(process.env.MONITORING_INTERVAL_HOURS || 6);
    const intervalMs = intervalHours * 60 * 60 * 1000;

    // Find all users configured for monitoring
    const monitoredUsers = await UserMonitoring.find({ monitoringEnabled: true });
    console.log(`Found ${monitoredUsers.length} users with monitoring enabled.`);

    const now = Date.now();
    let enqueuedCount = 0;

    for (const config of monitoredUsers) {
      const lastChecked = config.lastCheckedAt ? new Date(config.lastCheckedAt).getTime() : 0;

      // Enqueue if never checked or if elapsed time is greater than interval
      if (now - lastChecked >= intervalMs) {
        await monitoringQueue.add(
          CHECK_USER_JOB_NAME,
          { username: config.username },
          { jobId: config.username } // Deduplicate jobs on Redis
        );
        enqueuedCount++;
      }
    }

    console.log(`Finished lead monitoring cycle. Enqueued ${enqueuedCount} users for re-check.`);
  } catch (err) {
    console.error("Failed during lead monitoring cycle:", err);
  }
}

/**
 * Starts the periodic monitoring scheduler.
 */
export function startMonitoringScheduler() {
  const intervalHours = Number(process.env.MONITORING_INTERVAL_HOURS || 6);
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`Initializing Lead Monitoring scheduler. Run interval: every ${intervalHours} hours.`);

  // Execute check immediately on startup
  runMonitoringCycle();

  // Start interval timer
  schedulerInterval = setInterval(() => {
    runMonitoringCycle();
  }, intervalMs);
}

/**
 * Stops the periodic monitoring scheduler.
 */
export function stopMonitoringScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("Stopped Lead Monitoring scheduler.");
  }
}
