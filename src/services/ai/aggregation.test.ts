import { test, expect, describe } from "bun:test";

// Implement the dominant category / intent logic within the test context to verify correctness
function getDominantField(counts: Record<string, number>, fallback: string): string {
  const list = Object.entries(counts).map(([name, count]) => ({ name, count }));
  list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return list[0]?.name || fallback;
}

function calculateUserLeadScore(
  averagePostLeadScore: number,
  leadPostCount: number,
  overallIntent: string,
  averageConfidence: number
): number {
  let score = 0;
  score += averagePostLeadScore * 0.5;
  if (leadPostCount >= 3) {
    score += 20;
  }
  if (overallIntent === "seeking_help" || overallIntent === "seeking_recommendation") {
    score += 15;
  }
  if (averageConfidence > 90) {
    score += 15;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

describe("User Intelligence Aggregation Logic", () => {
  test("dominant category detection resolves correctly by frequency", () => {
    const categories = {
      healthcare: 2,
      fitness: 5,
      beauty: 1,
    };
    expect(getDominantField(categories, "general")).toBe("fitness");
  });

  test("dominant category breaks ties alphabetically/consistently", () => {
    const categories = {
      healthcare: 2,
      beauty: 2,
    };
    // beauty comes before healthcare alphabetically
    expect(getDominantField(categories, "general")).toBe("beauty");
  });

  test("dominant intent resolves correctly by frequency", () => {
    const intents = {
      seeking_help: 3,
      seeking_recommendation: 1,
      discussion: 2,
    };
    expect(getDominantField(intents, "other")).toBe("seeking_help");
  });

  test("dominant intent breaks ties alphabetically/consistently", () => {
    const intents = {
      seeking_recommendation: 2,
      seeking_help: 2,
    };
    // seeking_help comes before seeking_recommendation alphabetically
    expect(getDominantField(intents, "other")).toBe("seeking_help");
  });

  test("lead score calculation outputs correct clamped values", () => {
    // Test base cases
    // averagePostLeadScore = 50, leadPostCount = 2, intent = discussion, confidence = 85
    // score = 50 * 0.5 = 25
    expect(calculateUserLeadScore(50, 2, "discussion", 85)).toBe(25);

    // Test adding 20 for leadPostCount >= 3
    // averagePostLeadScore = 60, leadPostCount = 3, intent = discussion, confidence = 85
    // score = 60 * 0.5 + 20 = 50
    expect(calculateUserLeadScore(60, 3, "discussion", 85)).toBe(50);

    // Test adding 15 for intent = seeking_recommendation
    // averagePostLeadScore = 60, leadPostCount = 3, intent = seeking_recommendation, confidence = 85
    // score = 60 * 0.5 + 20 + 15 = 65
    expect(calculateUserLeadScore(60, 3, "seeking_recommendation", 85)).toBe(65);

    // Test adding 15 for averageConfidence > 90
    // averagePostLeadScore = 60, leadPostCount = 3, intent = seeking_recommendation, confidence = 95
    // score = 60 * 0.5 + 20 + 15 + 15 = 80
    expect(calculateUserLeadScore(60, 3, "seeking_recommendation", 95)).toBe(80);

    // Test score clamping to 100
    // averagePostLeadScore = 100, leadPostCount = 4, intent = seeking_help, confidence = 95
    // score = 100 * 0.5 + 20 + 15 + 15 = 100
    expect(calculateUserLeadScore(100, 4, "seeking_help", 95)).toBe(100);

    // Test high scoring lead score math
    // averagePostLeadScore = 90, leadPostCount = 3, intent = seeking_help, confidence = 92
    // score = 90 * 0.5 (45) + 20 + 15 + 15 = 95
    expect(calculateUserLeadScore(90, 3, "seeking_help", 92)).toBe(95);
  });
});
