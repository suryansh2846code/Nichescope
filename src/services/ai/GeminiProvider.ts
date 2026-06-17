import type { AIProvider, AnalysisResult, LeadQualificationResult } from "./AIProvider";

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "gemini-1.5-flash") {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async analyzeCaption(caption: string): Promise<AnalysisResult> {
    const systemPrompt = `You are an AI lead discovery agent. Analyze the provided Instagram caption and classify it into one of the categories and intents listed below. Also perform sentiment analysis.

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

Return a STRICT JSON response in this exact format, with no markdown wrappers or formatting:
{
  "isLead": boolean,
  "category": string,
  "intent": string,
  "confidence": number,
  "keywords": string[],
  "summary": string,
  "sentiment": string
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\nCaption to analyze:\n"${caption}"`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error (status ${response.status}): ${errText}`);
      }

      const resData = await response.json() as any;
      const textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResult) {
        throw new Error("Empty response from Gemini API");
      }

      const parsed = JSON.parse(textResult) as AnalysisResult;

      let parsedSentiment: "positive" | "neutral" | "negative" = "neutral";
      if (parsed.sentiment === "positive" || parsed.sentiment === "negative" || parsed.sentiment === "neutral") {
        parsedSentiment = parsed.sentiment;
      }

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
      console.error("Failed during Gemini caption analysis request:", err);
      throw err;
    }
  }

  async generateUserSummary(captions: string[]): Promise<string> {
    const systemPrompt = `You are an AI lead discovery agent. Generate a concise, single-sentence summary (maximum 250 characters) summarizing the user's interests, needs, and behaviors based on their recent posts.
Focus on lead intelligence and intent (e.g. 'User repeatedly discusses acne-related issues and is actively seeking dermatology recommendations.').
Your response must be direct, plain text, and must strictly not exceed 250 characters.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\nUser's recent post captions/summaries:\n${captions.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 150
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error (status ${response.status}): ${errText}`);
      }

      const resData = await response.json() as any;
      const textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!textResult) {
        throw new Error("Empty response from Gemini API");
      }

      return textResult.slice(0, 250);
    } catch (err) {
      console.error("Failed during Gemini user summary generation:", err);
      return `User has active posts. Discussed topics: ${captions.slice(0, 3).join(", ").slice(0, 150)}...`.slice(0, 250);
    }
  }

  async qualifyLead(
    username: string,
    summary: string,
    category: string,
    intent: string,
    leadScore: number,
    captions: string[]
  ): Promise<LeadQualificationResult> {
    const systemPrompt = `You are an AI lead qualification agent. Analyze the user's category, intent, summary, score, and their recent Instagram captions to extract their specific problem, service needed, urgency, buying intent, confidence, and a qualification reason.

Urgency Values:
- low
- medium
- high

Buying Intent Score:
- A number from 0 to 100 representing their readiness to purchase or contact.
  - Question only -> around 20
  - Seeking recommendations -> around 70
  - Actively searching / Urgent help needed -> around 90+

Confidence Score:
- A number from 0 to 100 representing classification confidence.

Return a STRICT JSON response in this exact format with no markdown wrappers or formatting:
{
  "problem": "Acne",
  "serviceNeeded": "Dermatologist",
  "urgency": "high",
  "buyingIntent": 92,
  "confidence": 95,
  "qualificationReason": "User repeatedly asks for dermatologist recommendations."
}`;

    const userPrompt = `User Profile details:
- Username: ${username}
- Category: ${category}
- Intent: ${intent}
- Lead Score: ${leadScore}
- Summary: ${summary}

Recent captions:
${captions.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\n${userPrompt}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error (status ${response.status}): ${errText}`);
      }

      const resData = await response.json() as any;
      const textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResult) {
        throw new Error("Empty response from Gemini API");
      }

      const parsed = JSON.parse(textResult) as LeadQualificationResult;

      let urgency: "low" | "medium" | "high" = "medium";
      if (parsed.urgency === "low" || parsed.urgency === "medium" || parsed.urgency === "high") {
        urgency = parsed.urgency;
      }

      return {
        problem: typeof parsed.problem === "string" ? parsed.problem : "General issue",
        serviceNeeded: typeof parsed.serviceNeeded === "string" ? parsed.serviceNeeded : "Consultant",
        urgency,
        buyingIntent: typeof parsed.buyingIntent === "number" ? parsed.buyingIntent : 50,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 80,
        qualificationReason: typeof parsed.qualificationReason === "string" ? parsed.qualificationReason : "Analyzed profile.",
      };
    } catch (err) {
      console.error("Failed during Gemini lead qualification request, falling back to mock provider logic:", err);
      // Fallback matching MockAIProvider's qualifyLead Heuristics
      const text = (summary + " " + captions.join(" ")).toLowerCase();

      if (text.includes("acne") || text.includes("dermatologist") || text.includes("skin")) {
        return {
          problem: "Acne",
          serviceNeeded: "Dermatologist",
          urgency: "high",
          buyingIntent: 92,
          confidence: 95,
          qualificationReason: "User repeatedly asks for dermatologist recommendations.",
        };
      }

      if (text.includes("fitness") || text.includes("gym") || text.includes("workout") || text.includes("trainer")) {
        return {
          problem: "Weight gain",
          serviceNeeded: "Personal Trainer",
          urgency: "medium",
          buyingIntent: 75,
          confidence: 85,
          qualificationReason: "User is looking for personal trainer and fitness suggestions.",
        };
      }

      if (text.includes("house") || text.includes("rent") || text.includes("apartment") || text.includes("home")) {
        return {
          problem: "Apartment search",
          serviceNeeded: "Real Estate Agent",
          urgency: "medium",
          buyingIntent: 70,
          confidence: 90,
          qualificationReason: "User is looking to rent an apartment.",
        };
      }

      if (
        text.includes("job") ||
        text.includes("career") ||
        text.includes("hiring") ||
        text.includes("recruiter") ||
        text.includes("coding")
      ) {
        return {
          problem: "Job search",
          serviceNeeded: "Recruiter",
          urgency: "high",
          buyingIntent: 88,
          confidence: 92,
          qualificationReason: "User is actively seeking job opportunities.",
        };
      }

      return {
        problem: "General inquiry",
        serviceNeeded: "Consultant",
        urgency: "low",
        buyingIntent: 40,
        confidence: 80,
        qualificationReason: "User is discussing general topics.",
      };
    }
  }
}
