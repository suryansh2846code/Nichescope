import type { EmbeddingProvider } from "./EmbeddingProvider.js";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private endpointUrl: string;
  private modelName: string;

  constructor(
    apiKey: string,
    endpointUrl = "https://api.openai.com/v1/embeddings",
    modelName = "text-embedding-3-small"
  ) {
    this.apiKey = apiKey;
    this.endpointUrl = endpointUrl;
    this.modelName = modelName;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim() === "") {
      throw new Error("Cannot generate embedding for empty text");
    }

    try {
      const response = await fetch(this.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: this.modelName,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI Embedding provider error (status ${response.status}): ${errText}`);
      }

      const resData = (await response.json()) as any;
      const embedding = resData.data?.[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error("Invalid or empty response format from OpenAI Embedding provider");
      }

      return embedding;
    } catch (err) {
      console.error("Failed during OpenAI embedding generation request:", err);
      throw err;
    }
  }
}
