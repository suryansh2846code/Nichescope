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
    const { postUrl, niche } = job.data;
    console.log(`Starting comment scrape job ${job.id} for post: ${postUrl}`);

    const match = postUrl.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    const postId = match ? match[1] : "unknown-post";

    try {
      // Scrape comments for the post
      const comments = await scrapeComments(postUrl);
      console.log(`Scraped ${comments.length} comments for post ${postId}`);

      let enqueuedComments = 0;

      for (const comment of comments) {
        const username = comment.username.toLowerCase().trim();
        const commentText = comment.text.trim();

        if (!username || !commentText) continue;

        // Generate a deterministic job ID to prevent duplicate analyses of the same comment
        // Hash the comment text to avoid issues with special characters in job ID
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
