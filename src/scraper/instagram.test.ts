import { describe, expect, test } from "bun:test";
import { parseInstagramCount, parseInstagramDescription, parsePostMetaDescription, extractHashtags, extractMentions } from "./instagram";

describe("Instagram scraper parsing", () => {
  test("parses plain and abbreviated Instagram counts", () => {
    expect(parseInstagramCount("1,234")).toBe(1234);
    expect(parseInstagramCount("12.5K")).toBe(12500);
    expect(parseInstagramCount("3.2M")).toBe(3200000);
    expect(parseInstagramCount("1.1B")).toBe(1100000000);
  });

  test("extracts profile stats and bio from meta description", () => {
    const parsed = parseInstagramDescription(
      "1.2M Followers, 340 Following, 921 Posts - See Instagram photos and videos from Yoga Teacher (@example)",
    );

    expect(parsed).toEqual({
      bio: "See Instagram photos and videos from Yoga Teacher (@example)",
      followerCount: 1200000,
      followingCount: 340,
      postCount: 921,
    });
  });

  test("parses post metadata description correctly", () => {
    const desc = '591K likes, 44K comments - instagram on June 12, 2026: "A new album and font go really nice together 🩷".';
    const parsed = parsePostMetaDescription(desc);

    expect(parsed).toEqual({
      likes: 591000,
      commentsCount: 44000,
      username: "instagram",
      dateStr: "June 12, 2026",
      caption: "A new album and font go really nice together 🩷",
    });
  });

  test("parses post description with missing likes or comments", () => {
    const desc1 = '123 likes - user_test on January 1, 2026: "Minimal info".';
    const parsed1 = parsePostMetaDescription(desc1);
    expect(parsed1?.likes).toBe(123);
    expect(parsed1?.commentsCount).toBeNull();

    const desc2 = 'user_test on January 1, 2026: "No stats".';
    const parsed2 = parsePostMetaDescription(desc2);
    expect(parsed2?.likes).toBeNull();
    expect(parsed2?.commentsCount).toBeNull();
    expect(parsed2?.username).toBe("user_test");
    expect(parsed2?.dateStr).toBe("January 1, 2026");
    expect(parsed2?.caption).toBe("No stats");
  });

  test("extracts hashtags and mentions correctly", () => {
    const caption = "Hello @world! Contact info@example.com or DM @john.doe_123. #fitness #healthy_life @olivia-rodrigo";
    expect(extractHashtags(caption)).toEqual(["fitness", "healthy_life"]);
    expect(extractMentions(caption)).toEqual(["world", "john.doe_123", "olivia"]);
  });
});
