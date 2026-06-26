import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import {
  COMMENT_SCRAPE_QUEUE_NAME,
  type CommentScrapeJobData,
  commentAnalysisQueue,
  COMMENT_ANALYZE_JOB_NAME,
} from "../queues/commentQueues";
import { scrapeComments } from "../scraper/instagram";
import { setupWorkerLogger } from "../utils/logger";
import { getSystemSettings } from "../models/SystemSettings";
import { discoveryEmitter, checkDiscoverySessionState } from "../services/discovery/discoveryEventEmitter";

// Setup logging interceptor
setupWorkerLogger("comment-scraper");

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in comment scrape worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

const worker = new Worker<CommentScrapeJobData>(
  COMMENT_SCRAPE_QUEUE_NAME,
  async (job) => {
    const { postUrl, niche, sessionId } = (job.data as any) || {};

    const shouldProceed = await checkDiscoverySessionState(sessionId);
    if (!shouldProceed) return;

    console.log(`Starting comment scrape job ${job.id} for post: ${postUrl}`);

    const match = postUrl.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    const postId = match ? match[1] : "unknown-post";

    try {
      const settings = await getSystemSettings();
      // Scrape comments for the post
      let comments = await scrapeComments(postUrl);
      comments = comments.slice(0, settings.maxCommentsScraped);
      console.log(`Scraped ${comments.length} comments (limited by setting) for post ${postId}`);

      if (sessionId) {
        await discoveryEmitter.emit(sessionId, "comments_extracted", {
          postId,
          postUrl,
          commentCount: comments.length,
          newComments: comments.map(c => ({
            username: c.username,
            text: c.text,
            timestamp: c.timestamp || new Date()
          }))
        });
      }

      let enqueuedComments = 0;

      for (const comment of comments) {
        const username = comment.username.toLowerCase().trim();
        const commentText = comment.text.trim();

        if (!username || !commentText) continue;

        // Deterministic job ID based on comment content — prevents duplicate analyses
        // of the same comment. The same posts are never re-enqueued so deduplication is safe.
        const commentHash = Bun.hash(commentText).toString();
        const analysisJobId = `analyze-${username}-${postId}-${commentHash}`;

        console.log(`Enqueuing comment analysis for @${username} on post ${postId}`);

        await commentAnalysisQueue.add(
          COMMENT_ANALYZE_JOB_NAME,
          {
            username,
            commentText,
            postUrl,
            niche,
            sessionId, // Propagate session
          },
          { jobId: analysisJobId }
        );
        enqueuedComments++;
      }

      return {
        postUrl,
        commentsScrapedCount: comments.length,
        enqueuedAnalysesCount: enqueuedComments,
        status: "success",
      };
    } catch (err) {
      console.error(
        `Failed to scrape comments for post ${postUrl}:`,
        err instanceof Error ? err.message : String(err)
      );
      if (sessionId) {
        try {
          await discoveryEmitter.emit(sessionId, "comments_extracted", {
            postId,
            postUrl,
            commentCount: 0,
            newComments: []
          });
        } catch (emitErr) {
          console.error("Failed to emit comments_extracted fallback on error:", emitErr);
        }
      }
      throw err;
    }
  },
  {
    connection: createRedisConnectionOptions(),
    concurrency: 2, // Allow scraping 2 posts concurrently
  }
);

worker.on("completed", (job) => {
  console.log(`Comment scrape job ${job.id} completed successfully`);
});

worker.on("failed", (job, error) => {
  console.error(`Comment scrape job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Comment scrape worker listening on "${COMMENT_SCRAPE_QUEUE_NAME}" queue`);
