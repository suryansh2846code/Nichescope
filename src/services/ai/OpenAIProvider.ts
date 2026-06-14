import type { AIProvider, AnalysisResult } from "./AIProvider";

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private endpointUrl: string;
  private modelName: string;

  constructor(apiKey: string, endpointUrl: string, modelName: string) {
    this.apiKey = apiKey;
    this.endpointUrl = endpointUrl;
    this.modelName = modelName;
  }

  async analyzeCaption(caption: string): Promise<AnalysisResult> {
    const systemPrompt = `You are an AI lead discovery agent. Analyze the provided Instagram caption and classify it into one of the following categories and intents. Also perform sentiment analysis.

Categories:
- healthcare (medical, skin conditions, health issues, doctors, dermatologists, etc.)
- fitness (gyms, workouts, yoga, personal trainers, exercise, etc.)
- real_estate (renting, buying, housing, apartments, houses, etc.)
- recruitment (hiring, job seeking, staffing, careers, etc.)
- education (schools, tutoring, courses, colleges, learning, etc.)
- finance (investing, savings, financial advice, crypto, banking, etc.)
- beauty (cosmetics, skincare, makeup, salons, products, etc.)
- technology (coding, apps, software, devices, computers, etc.)
- general (everything else)

Intents:
- seeking_help (struggling with a problem, needing a solution)
- seeking_recommendation (asking for suggestions, reviews, referrals)
- purchase_intent (asking for price, expressing desire to buy or order)
- complaint (unhappy with a service or product)
- question (asking a query)
- discussion (sharing opinions, starting a topic)
- promotion (advertising or promoting something)
- other (everything else)

Sentiment:
- positive (happy, satisfied, recommending, positive feedback)
- neutral (impartial, informational, sharing facts/news without clear emotional tilt)
- negative (frustrated, struggling, complaining, unhappy, in pain)

If the user is looking for advice, recommendations, buying options, or expressing struggle in one of these domains, set isLead to true. Otherwise, set it to false.
Confidence should be a number from 0 to 100 representing classification confidence.
Keywords should be 1-5 extracted words representing the topic.
Summary must be a short 1-sentence description of what the user is doing or seeking.

Return a STRICT JSON response in this exact format, with no markdown wrappers:
{
  "isLead": boolean,
  "category": string,
  "intent": string,
  "confidence": number,
  "keywords": string[],
  "summary": string,
  "sentiment": string
}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.endpointUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "https://github.com/suryansh2846code/Nichescope";
      headers["X-Title"] = "Nichescope";
    }

    try {
      const response = await fetch(this.endpointUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Caption to analyze:\n"${caption}"` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LLM provider error (status ${response.status}): ${errText}`);
      }

      const resData = (await response.json()) as any;
      const textResult = resData.choices?.[0]?.message?.content;

      if (!textResult) {
        throw new Error("Empty response content from LLM provider");
      }

      const parsed = JSON.parse(textResult) as AnalysisResult;

      let parsedSentiment: "positive" | "neutral" | "negative" = "neutral";
      if (parsed.sentiment === "positive" || parsed.sentiment === "negative" || parsed.sentiment === "neutral") {
        parsedSentiment = parsed.sentiment;
      }

      // Ensure properties are defined and formatted
      return {
        isLead: !!parsed.isLead,
        category: typeof parsed.category === "string" ? parsed.category.toLowerCase() : "general",
        intent: typeof parsed.intent === "string" ? parsed.intent.toLowerCase() : "other",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 80,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        summary: typeof parsed.summary === "string" ? parsed.summary : "No summary available.",
        sentiment: parsedSentiment,
      };
    } catch (err) {
      console.error("Failed during AI caption analysis request:", err);
      throw err;
    }
  }

  async generateUserSummary(captions: string[]): Promise<string> {
    const systemPrompt = `You are an AI lead discovery agent. Generate a concise, single-sentence summary (maximum 250 characters) summarizing the user's interests, needs, and behaviors based on their recent posts.
Focus on lead intelligence and intent (e.g. 'User repeatedly discusses acne-related issues and is actively seeking dermatology recommendations.').
Your response must be direct, plain text, and must strictly not exceed 250 characters.`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.endpointUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "https://github.com/suryansh2846code/Nichescope";
      headers["X-Title"] = "Nichescope";
    }

    try {
      const response = await fetch(this.endpointUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `User's recent post captions/summaries:\n${captions.map((c, i) => `${i + 1}. ${c}`).join("\n")}` },
          ],
          temperature: 0.3,
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LLM provider error (status ${response.status}): ${errText}`);
      }

      const resData = (await response.json()) as any;
      const textResult = resData.choices?.[0]?.message?.content?.trim();

      if (!textResult) {
        throw new Error("Empty response content from LLM provider");
      }

      return textResult.slice(0, 250);
    } catch (err) {
      console.error("Failed during AI user summary generation:", err);
      // Fallback
      return `User has active posts. Discussed topics: ${captions.slice(0, 3).join(", ").slice(0, 150)}...`.slice(0, 250);
    }
  }
}
