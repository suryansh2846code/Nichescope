import type { EmbeddingProvider } from "./EmbeddingProvider.js";

export class MockEmbeddingProvider implements EmbeddingProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    const textLower = text.toLowerCase();

    // Choose index range to boost based on category keywords
    let boostRange: [number, number] | null = null;

    if (
      textLower.includes("acne") ||
      textLower.includes("dermatologist") ||
      textLower.includes("skin") ||
      textLower.includes("doctor") ||
      textLower.includes("treatment") ||
      textLower.includes("breakout")
    ) {
      boostRange = [0, 50]; // Healthcare
    } else if (
      textLower.includes("fitness") ||
      textLower.includes("gym") ||
      textLower.includes("workout") ||
      textLower.includes("yoga") ||
      textLower.includes("trainer")
    ) {
      boostRange = [50, 100]; // Fitness
    } else if (
      textLower.includes("house") ||
      textLower.includes("rent") ||
      textLower.includes("apartment") ||
      textLower.includes("home") ||
      textLower.includes("property")
    ) {
      boostRange = [100, 150]; // Real Estate
    } else if (
      textLower.includes("makeup") ||
      textLower.includes("beauty") ||
      textLower.includes("lipstick") ||
      textLower.includes("salon") ||
      textLower.includes("cosmetics")
    ) {
      boostRange = [150, 200]; // Beauty
    } else if (
      textLower.includes("invest") ||
      textLower.includes("stocks") ||
      textLower.includes("finance") ||
      textLower.includes("crypto") ||
      textLower.includes("money")
    ) {
      boostRange = [200, 250]; // Finance
    } else if (
      textLower.includes("software") ||
      textLower.includes("coding") ||
      textLower.includes("programming") ||
      textLower.includes("tech") ||
      textLower.includes("app") ||
      textLower.includes("developer")
    ) {
      boostRange = [250, 300]; // Technology
    } else if (
      textLower.includes("hiring") ||
      textLower.includes("job") ||
      textLower.includes("career") ||
      textLower.includes("staffing") ||
      textLower.includes("recruiter")
    ) {
      boostRange = [300, 350]; // Recruitment
    } else if (
      textLower.includes("school") ||
      textLower.includes("tutoring") ||
      textLower.includes("course") ||
      textLower.includes("college") ||
      textLower.includes("learn") ||
      textLower.includes("education")
    ) {
      boostRange = [350, 400]; // Education
    }

    // Generate deterministic 1536-dimensional vector
    const dimensions = 1536;
    const seed = this.hashString(text);
    const rng = this.mulberry32(seed);

    const vector: number[] = [];
    for (let i = 0; i < dimensions; i++) {
      // Base random value between -0.1 and 0.1
      let val = (rng() * 2 - 1) * 0.1;

      // Apply strong boost if within the matched range
      if (boostRange && i >= boostRange[0] && i < boostRange[1]) {
        val += 0.8 + rng() * 0.2; // Significant boost
      }

      vector.push(val);
    }

    // L2 Normalize vector
    const sumSq = vector.reduce((sum, val) => sum + val * val, 0);
    const norm = Math.sqrt(sumSq) || 1;

    return vector.map(val => val / norm);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private mulberry32(a: number) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}
