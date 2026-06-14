import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { ANALYSIS_QUEUE_NAME, type AnalysisJobData } from "../queues/analysisQueue";
import { getAIProvider } from "../services/ai/AIProvider";
import { calculateLeadScore } from "../services/ai/scoring";
import { PostAnalysis } from "../models/PostAnalysis";
import { Post } from "../models/Post";
import { userIntelligenceQueue, AGGREGATE_USER_JOB_NAME } from "../queues/userIntelligenceQueue";
import { embeddingQueue, GENERATE_EMBEDDING_JOB_NAME } from "../queues/embeddingQueue";

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in AI analysis worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

const provider = getAIProvider();

const VALID_CATEGORIES = new Set([
  "healthcare",
  "fitness",
  "real_estate",
  "recruitment",
  "education",
  "finance",
  "beauty",
  "technology",
  "general",
]);

const VALID_INTENTS = new Set([
  "seeking_help",
  "seeking_recommendation",
  "purchase_intent",
  "complaint",
  "question",
  "discussion",
  "promotion",
  "other",
]);

export async function processAnalysisJob(job: {
  data: AnalysisJobData;
  updateProgress: (progress: number) => Promise<any>;
}) {
  const { postId, username, caption } = job.data;
  console.log(`Starting AI analysis for post ${postId} by @${username}`);
  await job.updateProgress(10);

  // Call LLM
  const result = await provider.analyzeCaption(caption);
  await job.updateProgress(60);

  // Validate Category
  let category = result.category || "general";
  if (!VALID_CATEGORIES.has(category)) {
    category = "general";
  }

  // Validate Intent
  let intent = result.intent || "other";
  if (!VALID_INTENTS.has(intent)) {
    intent = "other";
  }

  // Calculate deterministic lead score
  const leadScore = calculateLeadScore(
    result.isLead,
    result.confidence,
    intent,
    caption
  );

  // Upsert analysis to database
  await PostAnalysis.findOneAndUpdate(
    { postId },
    {
      postId,
      username: username.toLowerCase(),
      isLead: result.isLead,
      category,
      intent,
      confidence: result.confidence,
      leadScore,
      extractedKeywords: result.keywords,
      summary: result.summary,
      sentiment: result.sentiment || "neutral",
      analyzedAt: new Date(),
    },
    { upsert: true, returnDocument: "after" }
  );
  await job.updateProgress(80);

  // Mark post as analyzed in Post collection
  await Post.updateOne({ postId }, { $set: { isAnalyzed: true } });

  // Enqueue user intelligence aggregation task
  try {
    const cleanUser = username.toLowerCase();
    await userIntelligenceQueue.add(
      AGGREGATE_USER_JOB_NAME,
      { username: cleanUser },
      { jobId: cleanUser }
    );
    console.log(`Enqueued UserIntelligence aggregation for user @${cleanUser}`);
  } catch (err) {
    console.error(
      `Failed to enqueue user intelligence job for @${username}:`,
      err instanceof Error ? err.message : String(err)
    );
  }

  // Enqueue post embedding generation task
  try {
    const cleanUser = username.toLowerCase();
    await embeddingQueue.add(
      GENERATE_EMBEDDING_JOB_NAME,
      { postId, username: cleanUser },
      { jobId: postId }
    );
    console.log(`Enqueued PostEmbedding generation for post ${postId}`);
  } catch (err) {
    console.error(
      `Failed to enqueue embedding job for post ${postId}:`,
      err instanceof Error ? err.message : String(err)
    );
  }

  await job.updateProgress(100);

  console.log(
    `Finished AI analysis for post ${postId}. Lead: ${result.isLead}, Score: ${leadScore}, Category: ${category}, Intent: ${intent}`
  );

  return {
    postId,
    username,
    isLead: result.isLead,
    leadScore,
    category,
    intent,
    status: "success",
  };
}

const worker = new Worker<AnalysisJobData>(
  ANALYSIS_QUEUE_NAME,
  processAnalysisJob,
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`AI analysis job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`AI analysis job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`AI analysis worker listening on "${ANALYSIS_QUEUE_NAME}" queue`);
