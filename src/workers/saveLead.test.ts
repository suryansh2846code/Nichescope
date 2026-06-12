import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { Lead } from "../models/Lead";
import { saveOrUpdateScrapedProfile } from "./saveLead";

describe("saveOrUpdateScrapedProfile", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Delete any test leads we might have created
    await Lead.deleteMany({ username: { $in: ["test_user_1", "test_user_2"] } });
  });

  test("persists a new lead successfully", async () => {
    const profile = {
      username: "test_user_1",
      fullName: "Test User One",
      bio: "Software developer",
      followerCount: 500,
      followingCount: 200,
      postCount: 15,
      profileUrl: "https://instagram.com/test_user_1",
      scrapedAt: new Date(),
      rawData: {
        title: "Test User One Title",
        description: "Test description",
        canonicalUrl: "https://instagram.com/test_user_1"
      }
    };

    const lead = await saveOrUpdateScrapedProfile("tech", profile);

    expect(lead).toBeDefined();
    expect(lead.username).toBe("test_user_1");
    expect(lead.fullName).toBe("Test User One");
    expect(lead.bio).toBe("Software developer");
    expect(lead.followerCount).toBe(500);
    expect(lead.niche).toBe("tech");
    expect(lead.foundVia).toBe("instagram-scraper");

    // Double check it's in the DB
    const dbLead = await Lead.findOne({ username: "test_user_1" });
    expect(dbLead).not.toBeNull();
    expect(dbLead!.fullName).toBe("Test User One");
  });

  test("updates an existing lead and prevents duplicates", async () => {
    // 1. Create initial lead
    const profile = {
      username: "test_user_2",
      fullName: "Test User Two",
      bio: "Designer",
      followerCount: 1200,
      followingCount: 300,
      postCount: 50,
      profileUrl: "https://instagram.com/test_user_2",
      scrapedAt: new Date(),
      rawData: {
        title: "Test User Two Title",
        description: "Test description two",
        canonicalUrl: "https://instagram.com/test_user_2"
      }
    };

    const lead1 = await saveOrUpdateScrapedProfile("design", profile);
    expect(lead1).toBeDefined();

    // 2. Modify details of the same profile (test case insensitivity as well)
    const updatedProfile = {
      ...profile,
      username: "TEST_USER_2", // uppercase to test case insensitivity
      fullName: "Test User Two Updated",
      followerCount: 1500,
      scrapedAt: new Date()
    };

    const lead2 = await saveOrUpdateScrapedProfile("design-art", updatedProfile);
    expect(lead2).toBeDefined();
    expect(lead2._id.toString()).toBe(lead1._id.toString()); // Same document ID
    expect(lead2.fullName).toBe("Test User Two Updated");
    expect(lead2.followerCount).toBe(1500);
    expect(lead2.niche).toBe("design-art");

    // 3. Count documents to ensure no duplicate was created
    const count = await Lead.countDocuments({ username: { $regex: /^test_user_2$/i } });
    expect(count).toBe(1);
  });
});
