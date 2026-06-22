import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { EMBEDDING_QUEUE_NAME, type EmbeddingJobData } from "../queues/embeddingQueue";
import { Post } from "../models/Post";
import { PostEmbedding } from "../models/PostEmbedding";
import { getEmbeddingProvider, getEmbeddingModelName } from "../services/ai/EmbeddingProvider";
import { setupWorkerLogger } from "../utils/logger";

setupWorkerLogger("embedding");


// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in embedding worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

export async function processEmbeddingJob(job: {
  data: EmbeddingJobData;
  updateProgress: (progress: number) => Promise<any>;
}) {
  const { postId, username } = job.data;
  console.log(`Starting post embedding generation for post ${postId} by @${username}`);
  await job.updateProgress(10);

  // 1. Check if embedding already exists
  const existing = await PostEmbedding.findOne({ postId });
  if (existing) {
    console.log(`PostEmbedding for post ${postId} already exists. Skipping.`);
    await job.updateProgress(100);
    return { postId, status: "skipped", reason: "duplicate" };
  }
  await job.updateProgress(30);

  // 2. Fetch the post to get the caption
  const post = await Post.findOne({ postId });
  if (!post) {
    throw new Error(`Post with ID ${postId} not found in database.`);
  }
  await job.updateProgress(50);

  const caption = post.caption || "";
  if (caption.trim() === "") {
    console.log(`Post ${postId} has no caption or caption is empty. Skipping embedding.`);
    await job.updateProgress(100);
    return { postId, status: "skipped", reason: "empty_caption" };
  }

  // 3. Generate embedding vector
  const provider = getEmbeddingProvider();
  const modelName = getEmbeddingModelName();
  const vector = await provider.generateEmbedding(caption);
  await job.updateProgress(80);

  // 4. Save embedding to database
  await PostEmbedding.create({
    postId,
    username: username.toLowerCase(),
    embedding: vector,
    model: modelName,
    createdAt: new Date(),
  });
  await job.updateProgress(100);

  console.log(`Successfully generated and saved embedding for post ${postId} using model ${modelName}`);
  return { postId, status: "success" };
}

const worker = new Worker<EmbeddingJobData>(
  EMBEDDING_QUEUE_NAME,
  processEmbeddingJob,
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Embedding job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Embedding job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Embedding worker listening on "${EMBEDDING_QUEUE_NAME}" queue`);
