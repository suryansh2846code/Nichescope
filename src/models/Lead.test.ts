import { describe, expect, test } from "bun:test";
import { Lead } from "./Lead";

describe("Lead model", () => {
  test("requires username, profileUrl, foundVia, and niche", async () => {
    const lead = new Lead({});

    await expect(lead.validate()).rejects.toThrow();
  });

  test("sets Phase 2 defaults for optional lead fields", () => {
    const lead = new Lead({
      username: "example_user",
      profileUrl: "https://instagram.com/example_user",
      foundVia: "source_profile",
      niche: "yoga",
    });

    expect(lead.fullName).toBe("");
    expect(lead.bio).toBe("");
    expect(lead.followerCount).toBe(0);
    expect(lead.followingCount).toBe(0);
    expect(lead.rawData).toEqual({});
  });
});
