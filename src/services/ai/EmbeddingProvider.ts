export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

import { MockEmbeddingProvider } from "./MockEmbeddingProvider";
import { OpenAIEmbeddingProvider } from "./OpenAIEmbeddingProvider";

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.AI_PROVIDER || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";

  if (provider.toLowerCase() === "openai" && openaiKey) {
    return new OpenAIEmbeddingProvider(openaiKey);
  }

  // Fallback / Default to Mock provider
  return new MockEmbeddingProvider();
}

export function getEmbeddingModelName(): string {
  const provider = process.env.AI_PROVIDER || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";

  if (provider.toLowerCase() === "openai" && openaiKey) {
    return "text-embedding-3-small";
  }

  return "mock-embedding-model";
}
