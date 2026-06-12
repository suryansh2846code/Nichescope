import { describe, expect, test } from "bun:test";
import { parseInstagramCount, parseInstagramDescription } from "./instagram";

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
});
