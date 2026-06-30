export interface AnalysisResult {
  isLead: boolean;
  category: string;
  intent: string;
  confidence: number;
  keywords: string[];
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
}

export interface LeadQualificationResult {
  problem: string;
  serviceNeeded: string;
  urgency: "low" | "medium" | "high";
  buyingIntent: number;
  confidence: number;
  qualificationReason: string;
}

export interface AIProvider {
  analyzeCaption(caption: string): Promise<AnalysisResult>;
  generateUserSummary(captions: string[]): Promise<string>;
  qualifyLead(
    username: string,
    summary: string,
    category: string,
    intent: string,
    leadScore: number,
    captions: string[]
  ): Promise<LeadQualificationResult>;
}

import { MockAIProvider } from "./MockAIProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { GeminiProvider } from "./GeminiProvider";

export function getAIProvider(): AIProvider {
  const isTest = process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun.env.NODE_ENV === "test");
  if (isTest) {
    return new MockAIProvider();
  }

  const provider = process.env.AI_PROVIDER || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const openrouterKey = process.env.OPENROUTER_API_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || "";

  if (provider.toLowerCase() === "gemini" && geminiKey) {
    return new GeminiProvider(geminiKey, "gemini-2.5-flash");
  }

  if (provider.toLowerCase() === "openai" && openaiKey) {
    return new OpenAIProvider(openaiKey, "https://api.openai.com/v1/chat/completions", "gpt-4o-mini");
  }

  if (provider.toLowerCase() === "openrouter" && openrouterKey) {
    return new OpenAIProvider(openrouterKey, "https://openrouter.ai/api/v1/chat/completions", "meta-llama/llama-3-8b-instruct");
  }

  const groqKey = process.env.GROQ_API_KEY || "";
  if (provider.toLowerCase() === "groq" && groqKey) {
    return new OpenAIProvider(groqKey, "https://api.groq.com/openai/v1/chat/completions", "llama-3.1-8b-instant");
  }

  throw new Error(
    "AI provider is not configured. Please set AI_PROVIDER='gemini' and GEMINI_API_KEY in your .env file."
  );
}
