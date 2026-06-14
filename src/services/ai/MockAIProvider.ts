import type { AIProvider, AnalysisResult } from "./AIProvider";

export class MockAIProvider implements AIProvider {
  async analyzeCaption(caption: string): Promise<AnalysisResult> {
    const text = caption.toLowerCase();

    // Default values
    let isLead = false;
    let category = "general";
    let intent = "discussion";
    let confidence = 85;
    const keywords: string[] = [];
    let summary = "User is discussing a topic.";

    // Match categories
    if (text.includes("acne") || text.includes("dermatologist") || text.includes("skin") || text.includes("doctor")) {
      category = "healthcare";
      keywords.push("acne", "skincare");
    } else if (text.includes("fitness") || text.includes("gym") || text.includes("workout") || text.includes("yoga")) {
      category = "fitness";
      keywords.push("fitness", "workout");
    } else if (text.includes("house") || text.includes("rent") || text.includes("apartment") || text.includes("home")) {
      category = "real_estate";
      keywords.push("real_estate", "housing");
    } else if (text.includes("makeup") || text.includes("beauty") || text.includes("lipstick")) {
      category = "beauty";
      keywords.push("beauty", "makeup");
    } else if (text.includes("invest") || text.includes("stocks") || text.includes("finance") || text.includes("crypto")) {
      category = "finance";
      keywords.push("finance", "investing");
    } else if (text.includes("software") || text.includes("coding") || text.includes("programming") || text.includes("tech")) {
      category = "technology";
      keywords.push("tech", "software");
    }

    // Match intents
    if (text.includes("recommend") || text.includes("suggest") || text.includes("where can i")) {
      intent = "seeking_recommendation";
      isLead = true;
      confidence = 95;
      summary = `User is seeking recommendations related to ${category}.`;
    } else if (text.includes("help") || text.includes("struggle") || text.includes("worse") || text.includes("worsening")) {
      intent = "seeking_help";
      isLead = true;
      confidence = 90;
      summary = `User is seeking help with a ${category} issue.`;
    } else if (text.includes("buy") || text.includes("purchase") || text.includes("price") || text.includes("how much")) {
      intent = "purchase_intent";
      isLead = true;
      confidence = 92;
      summary = `User exhibits purchase intent for ${category} items.`;
    } else if (text.includes("complain") || text.includes("hate") || text.includes("worst") || text.includes("bad service")) {
      intent = "complaint";
      confidence = 88;
      summary = `User is posting a complaint related to ${category}.`;
    } else if (text.includes("?")) {
      intent = "question";
      confidence = 85;
      summary = `User is asking a question about ${category}.`;
    }

    // Extract some simple words as keywords if empty
    if (keywords.length === 0) {
      const words = text.split(/\s+/).filter(w => w.length > 4).slice(0, 3);
      keywords.push(...words.map(w => w.replace(/[^a-z0-9]/gi, "")));
    }

    return {
      isLead,
      category,
      intent,
      confidence,
      keywords,
      summary,
    };
  }

  async generateUserSummary(captions: string[]): Promise<string> {
    if (captions.length === 0) {
      return "No posts available to summarize.";
    }

    const text = captions.join(" ").toLowerCase();
    let detectedCategory = "general topics";
    let behavior = "discusses general topics";

    if (text.includes("acne") || text.includes("dermatologist") || text.includes("skin")) {
      detectedCategory = "acne-related issues and skincare";
      behavior = "is actively seeking dermatologist recommendations and struggling with skin health";
    } else if (text.includes("fitness") || text.includes("gym") || text.includes("workout") || text.includes("yoga")) {
      detectedCategory = "fitness and workout routines";
      behavior = "is seeking recommendations for local gyms, yoga studios, or trainers";
    } else if (text.includes("house") || text.includes("rent") || text.includes("apartment")) {
      detectedCategory = "housing and rental search";
      behavior = "is searching for property recommendations, rental details, or buying options";
    } else if (text.includes("makeup") || text.includes("beauty")) {
      detectedCategory = "beauty and makeup products";
      behavior = "regularly reviews skincare, beauty accessories, and makeup routines";
    } else if (text.includes("software") || text.includes("coding") || text.includes("programming")) {
      detectedCategory = "software engineering and programming languages";
      behavior = "discusses tech trends, programming advice, and development tools";
    }

    const summary = `User repeatedly discusses ${detectedCategory} and ${behavior}.`;
    return summary.slice(0, 250);
  }
}
