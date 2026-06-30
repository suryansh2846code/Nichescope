import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { COMMENT_ANALYSIS_QUEUE_NAME, type CommentAnalysisJobData } from "../queues/commentQueues";
import { CommentAnalysis } from "../models/CommentAnalysis";
import { Lead } from "../models/Lead";
import { scrapeQueue, SCRAPE_PROFILE_JOB_NAME } from "../queues/scrapeQueue";
import { getAIProvider } from "../services/ai/AIProvider";
import { setupWorkerLogger } from "../utils/logger";
import { discoveryEmitter, checkDiscoverySessionState } from "../services/discovery/discoveryEventEmitter";

// Setup logging interceptor
setupWorkerLogger("comment-analysis");

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in comment analysis worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

const worker = new Worker<CommentAnalysisJobData>(
  COMMENT_ANALYSIS_QUEUE_NAME,
  async (job) => {
    const { username, commentText, postUrl, niche, sessionId } = (job.data as any) || {};
    
    const shouldProceed = await checkDiscoverySessionState(sessionId);
    if (!shouldProceed) return;

    const normalizedUser = username.toLowerCase().trim();
    console.log(`Starting AI analysis for comment by @${normalizedUser}: "${commentText.slice(0, 50)}..."`);

    try {
      const provider = getAIProvider();
      
      // Analyze comment using AI caption analyzer
      const result = await provider.analyzeCaption(commentText);
      console.log(`AI Classification result: category=${result.category}, intent=${result.intent}, isLead=${result.isLead}`);

      // Save analysis results
      const commentAnalysis = await CommentAnalysis.findOneAndUpdate(
        { username: normalizedUser, commentText, postUrl },
        {
          username: normalizedUser,
          commentText,
          postUrl,
          intentScore: result.confidence,
          isLead: result.isLead,
          niche,
          category: result.category,
          intent: result.intent,
          analyzedAt: new Date(),
          ...(sessionId ? { sessionId } : {}),
        },
        { upsert: true, returnDocument: "after" }
      );

      if (sessionId) {
        await discoveryEmitter.emit(sessionId, "comment_analyzed", {
          username: normalizedUser,
          comment: commentText,
          isLead: result.isLead,
          category: result.category,
          intent: result.intent,
          confidence: result.confidence,
          timestamp: new Date()
        });
      }

      // If the comment passes the AI lead gate, create a lead immediately and enqueue profile enrichment
      if (result.isLead) {
        console.log(`[QUALIFIED COMMENT] @${normalizedUser} showed lead intent. Checking duplication...`);

        // Check if lead already exists in Leads DB
        const existingLead = await Lead.findOne({
          username: new RegExp(`^${normalizedUser}$`, "i"),
        });

        if (existingLead) {
          console.log(`Lead for @${normalizedUser} already exists. Skipping profile scrape.`);
          return {
            username: normalizedUser,
            isLead: true,
            action: "skipped_duplicate_lead",
            commentAnalysisId: commentAnalysis._id,
          };
        }

        // Create placeholder lead immediately so it's never lost to scrape timeouts
        await Lead.create({
          username: normalizedUser,
          fullName: "",
          bio: "",
          profileUrl: `https://www.instagram.com/${normalizedUser}/`,
          niche,
          foundVia: "comment-analysis",
          scrapedAt: new Date(),
          rawData: { commentText, postUrl, category: result.category, intent: result.intent },
        });
        console.log(`[LEAD SAVED] Created placeholder lead for @${normalizedUser}`);

        if (sessionId) {
          await discoveryEmitter.emit(sessionId, "lead_created", {
            username: normalizedUser,
            niche,
            postUrl,
            category: result.category,
            intent: result.intent,
          });
        }

        // Enqueue profile scrape to enrich the placeholder with real profile data
        const scrapeJobId = `scrape-${normalizedUser}-${Date.now()}`;
        console.log(`Enqueuing profile enrichment scrape for @${normalizedUser}`);
        await scrapeQueue.add(
          SCRAPE_PROFILE_JOB_NAME,
          {
            username: normalizedUser,
            niche,
            sessionId,
          },
          { jobId: scrapeJobId }
        );

        return {
          username: normalizedUser,
          isLead: true,
          action: "lead_created_and_enqueued_enrichment",
          commentAnalysisId: commentAnalysis._id,
        };
      }

      return {
        username: normalizedUser,
        isLead: false,
        action: "discarded",
        commentAnalysisId: commentAnalysis._id,
      };
    } catch (err) {
      console.error(
        `Failed to analyze comment for @${normalizedUser}:`,
        err instanceof Error ? err.message : String(err)
      );
      if (sessionId) {
        try {
          await discoveryEmitter.emit(sessionId, "comment_error", {
            username: normalizedUser,
            comment: commentText,
            reason: err instanceof Error ? err.message : String(err),
            timestamp: new Date()
          });
        } catch (emitErr) {
          console.error("Failed to emit comment_error on analysis failure:", emitErr);
        }
      }
      throw err;
    }
  },
  {
    connection: createRedisConnectionOptions(),
    concurrency: 4, // Higher concurrency since AI calls are fast and mostly network IO
  }
);

worker.on("completed", (job) => {
  console.log(`Comment analysis job ${job.id} completed successfully`);
});

worker.on("failed", (job, error) => {
  console.error(`Comment analysis job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Comment analysis worker listening on "${COMMENT_ANALYSIS_QUEUE_NAME}" queue`);
