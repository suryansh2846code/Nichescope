import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { Post } from "../models/Post";
import { PostEmbedding } from "../models/PostEmbedding";
import { processEmbeddingJob } from "./embeddingWorker";

describe("Post Embedding Worker", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear test posts and embedding records
    await Post.deleteMany({ username: "test_emb_worker_user" });
    await PostEmbedding.deleteMany({ username: "test_emb_worker_user" });
  });

  test("processEmbeddingJob correctly generates and saves embedding", async () => {
    const postId = "test_emb_post_1";
    const username = "test_emb_worker_user";

    // 1. Create a post in the database
    await Post.create({
      postId,
      username,
      caption: "I need recommended acne dermatologist treatment #skin",
      postUrl: "https://instagram.com/p/test_emb_post_1",
      scrapedAt: new Date(),
    });

    const mockJob = {
      data: {
        postId,
        username,
      },
      updateProgress: async (progress: number) => {
        return Promise.resolve();
      },
    };

    // 2. Run processEmbeddingJob
    const result = await processEmbeddingJob(mockJob);
    expect(result.status).toBe("success");
    expect(result.postId).toBe(postId);

    // 3. Verify in database
    const savedEmbedding = await PostEmbedding.findOne({ postId });
    expect(savedEmbedding).not.toBeNull();
    expect(savedEmbedding!.username).toBe(username);
    expect(savedEmbedding!.embedding.length).toBe(1536);
    expect((savedEmbedding as any).model).toBe("mock-embedding-model");
  });

  test("processEmbeddingJob skips processing if embedding already exists", async () => {
    const postId = "test_emb_post_2";
    const username = "test_emb_worker_user";

    // Create a PostEmbedding record beforehand to simulate duplicate job
    await PostEmbedding.create({
      postId,
      username,
      embedding: new Array(1536).fill(0.1),
      model: "mock-embedding-model",
      createdAt: new Date(),
    });

    const mockJob = {
      data: {
        postId,
        username,
      },
      updateProgress: async (progress: number) => {
        return Promise.resolve();
      },
    };

    const result = await processEmbeddingJob(mockJob);
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("duplicate");

    // DB count should remain 1
    const count = await PostEmbedding.countDocuments({ postId });
    expect(count).toBe(1);
  });

  test("processEmbeddingJob skips if caption is empty", async () => {
    const postId = "test_emb_post_3";
    const username = "test_emb_worker_user";

    // Create a post with empty caption
    await Post.create({
      postId,
      username,
      caption: "",
      postUrl: "https://instagram.com/p/test_emb_post_3",
      scrapedAt: new Date(),
    });

    const mockJob = {
      data: {
        postId,
        username,
      },
      updateProgress: async (progress: number) => {
        return Promise.resolve();
      },
    };

    const result = await processEmbeddingJob(mockJob);
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("empty_caption");

    // No embedding saved
    const savedEmbedding = await PostEmbedding.findOne({ postId });
    expect(savedEmbedding).toBeNull();
  });
});
