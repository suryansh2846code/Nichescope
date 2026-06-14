export interface AnalysisResult {
  isLead: boolean;
  category: string;
  intent: string;
  confidence: number;
  keywords: string[];
  summary: string;
}

export interface AIProvider {
  analyzeCaption(caption: string): Promise<AnalysisResult>;
}

import { MockAIProvider } from "./MockAIProvider";
import { OpenAIProvider } from "./OpenAIProvider";

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const openrouterKey = process.env.OPENROUTER_API_KEY || "";

  if (provider.toLowerCase() === "openai" && openaiKey) {
    return new OpenAIProvider(openaiKey, "https://api.openai.com/v1/chat/completions", "gpt-4o-mini");
  }

  if (provider.toLowerCase() === "openrouter" && openrouterKey) {
    return new OpenAIProvider(openrouterKey, "https://openrouter.ai/api/v1/chat/completions", "meta-llama/llama-3-8b-instruct:free");
  }

  // Fallback / Default to Mock provider when no keys are set or mock is requested
  console.log("Using MockAIProvider for post caption analysis.");
  return new MockAIProvider();
}
