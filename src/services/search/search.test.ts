import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../../db";
import { Post } from "../../models/Post";
import { PostAnalysis } from "../../models/PostAnalysis";
import { UserIntelligence } from "../../models/UserIntelligence";
import { PostEmbedding } from "../../models/PostEmbedding";
import { cosineSimilarity, searchSemanticPosts, queryCache } from "./searchService";
import { getEmbeddingProvider } from "../ai/EmbeddingProvider";
import searchRouter from "../../routes/search";

describe("Semantic Search & Cosine Similarity Service", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections for test user
    await Post.deleteMany({ username: "test_search_user" });
    await PostAnalysis.deleteMany({ username: "test_search_user" });
    await UserIntelligence.deleteMany({ username: "test_search_user" });
    await PostEmbedding.deleteMany({ username: "test_search_user" });
    queryCache.clear();
  });

  test("cosineSimilarity calculates similarity correctly", () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0, 5);

    const v3 = [0, 1, 0];
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(0.0, 5);

    // Negative similarity should be clamped to 0.0
    const v4 = [-1, 0, 0];
    expect(cosineSimilarity(v1, v4)).toBe(0.0);
  });

  test("MockEmbeddingProvider generates deterministic unit vectors with category skew", async () => {
    const provider = getEmbeddingProvider();
    
    // Healthcare texts
    const text1 = "My acne is breaking out and I need dermatologist recommendations";
    const text2 = "Looking for acne skin treatments";
    // Fitness texts
    const text3 = "Struggling with my workout routine at the gym";

    const emb1 = await provider.generateEmbedding(text1);
    const emb2 = await provider.generateEmbedding(text2);
    const emb3 = await provider.generateEmbedding(text3);

    // Verify 1536 dimensions
    expect(emb1.length).toBe(1536);
    expect(emb2.length).toBe(1536);
    expect(emb3.length).toBe(1536);

    // Verify L2 normalization
    const sumSq1 = emb1.reduce((sum, val) => sum + val * val, 0);
    expect(sumSq1).toBeCloseTo(1.0, 5);

    // Check similarity between healthcare texts is higher than between healthcare and fitness
    const simHealth = cosineSimilarity(emb1, emb2);
    const simHealthFitness = cosineSimilarity(emb1, emb3);

    expect(simHealth).toBeGreaterThan(0.8);
    expect(simHealthFitness).toBeLessThan(0.3);
  });

  test("queryCache caches generated query vectors", async () => {
    const query = "fitness goals and workout tips";
    
    expect(queryCache.has(query)).toBe(false);
    
    const results1 = await searchSemanticPosts(query);
    expect(queryCache.has(query)).toBe(true);

    const cachedVector = queryCache.get(query);
    expect(cachedVector).toBeDefined();

    // Verify caching by modifying cache directly and seeing if it retrieves modified vector
    const modifiedVector = new Array(1536).fill(0.5);
    queryCache.set(query, modifiedVector);

    // Create a temporary embedding in DB to compare against
    await PostEmbedding.create({
      postId: "temp_test_cache_post",
      username: "test_search_user",
      embedding: modifiedVector,
      model: "test-model",
      createdAt: new Date(),
    });

    const results2 = await searchSemanticPosts(query);
    expect(results2.length).toBeGreaterThan(0);
    expect(results2[0]!.similarity).toBeCloseTo(1.0, 5); // since query vector matches post embedding exactly
  });

  test("searchSemanticPosts ranks matches and deduplicates by username", async () => {
    const username = "test_search_user";

    // Create 2 posts for the same user
    await Post.create({
      postId: "post_health_1",
      username,
      caption: "Struggling with severe hormonal acne breakout",
      postUrl: "url1",
    });
    await PostAnalysis.create({
      postId: "post_health_1",
      username,
      isLead: true,
      category: "healthcare",
      intent: "seeking_help",
      confidence: 90,
      leadScore: 90,
      extractedKeywords: ["acne"],
      summary: "User has acne problems",
    });
    const provider = getEmbeddingProvider();
    const embHealth = await provider.generateEmbedding("Struggling with severe hormonal acne breakout");
    await PostEmbedding.create({
      postId: "post_health_1",
      username,
      embedding: embHealth,
      model: "mock-model",
    });

    await Post.create({
      postId: "post_health_2",
      username,
      caption: "Need a dermatologist for my skin breakout",
      postUrl: "url2",
    });
    await PostAnalysis.create({
      postId: "post_health_2",
      username,
      isLead: true,
      category: "healthcare",
      intent: "seeking_recommendation",
      confidence: 95,
      leadScore: 95,
      extractedKeywords: ["dermatologist"],
      summary: "User needs doctor",
    });
    const embHealth2 = await provider.generateEmbedding("Need a dermatologist for my skin breakout");
    await PostEmbedding.create({
      postId: "post_health_2",
      username,
      embedding: embHealth2,
      model: "mock-model",
    });

    // Create a UserIntelligence profile
    await UserIntelligence.create({
      username,
      overallCategory: "healthcare",
      overallIntent: "seeking_recommendation",
      confidence: 95,
      leadScore: 95,
      summary: "User needs skincare treatment advice",
      postCountAnalyzed: 2,
      leadPostCount: 2,
      categories: [{ category: "healthcare", count: 2 }],
      intents: [{ intent: "seeking_recommendation", count: 1 }, { intent: "seeking_help", count: 1 }],
      analyzedAt: new Date(),
    });

    // Search query
    const searchResults = await searchSemanticPosts("acne treatment");
    
    // Result should be deduplicated on username
    const userMatches = searchResults.filter((r) => r.username === username);
    expect(userMatches.length).toBe(1);
    expect(userMatches[0]!.username).toBe(username);
    expect(userMatches[0]!.category).toBe("healthcare");
    expect(userMatches[0]!.leadScore).toBe(95);
    expect(userMatches[0]!.summary).toBe("User needs skincare treatment advice");
  });

  test("Search Router API returns formatted JSON response", async () => {
    // We can directly test the router handler function using a mock req/res
    let resData: any = null;
    let resStatus = 200;

    const mockReq = {
      query: { q: "acne treatment", limit: "5" },
    } as any;

    const mockRes = {
      json: (data: any) => {
        resData = data;
        return mockRes;
      },
      status: (code: number) => {
        resStatus = code;
        return mockRes;
      },
    } as any;

    // Retrieve route stack handler
    const routeHandler = searchRouter.stack[0]!.route!.stack[0]!.handle;

    await routeHandler(mockReq, mockRes, (err: any) => {
      if (err) throw err;
    });

    expect(resStatus).toBe(200);
    expect(Array.isArray(resData)).toBe(true);
  });
});
