import { Post } from "../../models/Post.js";
import { PostAnalysis } from "../../models/PostAnalysis.js";
import { UserIntelligence } from "../../models/UserIntelligence.js";
import { PostEmbedding } from "../../models/PostEmbedding.js";
import { getEmbeddingProvider } from "../ai/EmbeddingProvider.js";

// In-memory cache for query embeddings to optimize repeat searches
export const queryCache = new Map<string, number[]>();

/**
 * Calculates the cosine similarity between two vectors.
 * Returns a score between 0.0 and 1.0.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: query dimension ${a.length} != stored dimension ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

  // Clamp to 0.0 - 1.0 range
  return Math.max(0.0, Math.min(1.0, similarity));
}

export interface SemanticSearchResult {
  username: string;
  similarity: number;
  postId: string;
  caption: string;
  category: string;
  intent: string;
  leadScore: number;
  summary: string;
}

/**
 * Searches posts semantically using cosine similarity on embeddings.
 * Deduplicates results at the username level, returning only the highest matching post.
 * Limits results to the top 50 matches.
 */
export async function searchSemanticPosts(query: string, limit = 50): Promise<SemanticSearchResult[]> {
  if (!query || query.trim() === "") {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();

  // 1. Get query embedding (either from cache or generate new)
  let queryVector = queryCache.get(normalizedQuery);
  if (!queryVector) {
    const provider = getEmbeddingProvider();
    queryVector = await provider.generateEmbedding(query);
    queryCache.set(normalizedQuery, queryVector);
  }

  // 2. Load all post embeddings with valid embedding vectors
  const storedEmbeddings = await PostEmbedding.find({
    embedding: { $exists: true, $not: { $size: 0 } },
  });

  // 3. Compute cosine similarity for each stored embedding
  interface MatchScore {
    postId: string;
    username: string;
    similarity: number;
  }

  const rawMatches: MatchScore[] = [];
  for (const stored of storedEmbeddings) {
    if (!stored.embedding || stored.embedding.length === 0) {
      continue;
    }

    try {
      const sim = cosineSimilarity(queryVector, stored.embedding);
      rawMatches.push({
        postId: stored.postId,
        username: stored.username,
        similarity: sim,
      });
    } catch (err) {
      console.error(`Error calculating similarity for post ${stored.postId}:`, err);
    }
  }

  // 4. Sort matches by similarity descending
  rawMatches.sort((a, b) => b.similarity - a.similarity);

  // 5. Deduplicate by username (keeping the highest similarity match per user)
  const seenUsers = new Set<string>();
  const uniqueMatches: MatchScore[] = [];

  for (const match of rawMatches) {
    const cleanUsername = match.username.toLowerCase();
    if (!seenUsers.has(cleanUsername)) {
      seenUsers.add(cleanUsername);
      uniqueMatches.push(match);
    }
  }

  // 6. Cap results at limit (default 50)
  const topMatches = uniqueMatches.slice(0, limit);

  // 7. Hydrate matches with data from Post, PostAnalysis, and UserIntelligence
  const results: SemanticSearchResult[] = [];
  for (const match of topMatches) {
    const [post, postAnalysis, userIntel] = await Promise.all([
      Post.findOne({ postId: match.postId }),
      PostAnalysis.findOne({ postId: match.postId }),
      UserIntelligence.findOne({ username: match.username }),
    ]);

    results.push({
      username: match.username,
      similarity: parseFloat(match.similarity.toFixed(4)),
      postId: match.postId,
      caption: post?.caption || "",
      category: userIntel?.overallCategory || postAnalysis?.category || "general",
      intent: userIntel?.overallIntent || postAnalysis?.intent || "other",
      leadScore: userIntel?.leadScore ?? postAnalysis?.leadScore ?? 0,
      summary: userIntel?.summary || postAnalysis?.summary || "No summary available.",
    });
  }

  return results;
}
