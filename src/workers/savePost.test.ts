import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { Post } from "../models/Post";
import { saveOrUpdatePosts } from "./savePost";

describe("saveOrUpdatePosts", () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Post.deleteMany({ username: { $in: ["test_user_posts", "test_user_posts_updated"] } });
  });

  test("persists posts successfully in bulk", async () => {
    const posts = [
      {
        postId: "post_id_1",
        caption: "Learning TypeScript #coding #webdev @mentor",
        postUrl: "https://instagram.com/p/post_id_1",
        postedAt: new Date("2026-06-10T12:00:00Z"),
        likes: 120,
        commentsCount: 15,
        hashtags: ["coding", "webdev"],
        mentions: ["mentor"]
      },
      {
        postId: "post_id_2",
        caption: "A beautiful sunset #nature",
        postUrl: "https://instagram.com/p/post_id_2",
        postedAt: new Date("2026-06-11T12:00:00Z"),
        likes: 350,
        commentsCount: 42,
        hashtags: ["nature"],
        mentions: []
      }
    ];

    const result = await saveOrUpdatePosts("TEST_USER_POSTS", posts);
    expect(result).not.toBeNull();
    expect(result!.upsertedCount).toBe(2);

    // Verify normalization and persistence
    const dbPosts = await Post.find({ username: "test_user_posts" }).sort({ postId: 1 });
    expect(dbPosts.length).toBe(2);
    expect(dbPosts[0].postId).toBe("post_id_1");
    expect(dbPosts[0].caption).toContain("Learning TypeScript");
    expect(dbPosts[0].likes).toBe(120);
    expect(dbPosts[0].hashtags).toEqual(["coding", "webdev"]);
    expect(dbPosts[0].mentions).toEqual(["mentor"]);

    expect(dbPosts[1].postId).toBe("post_id_2");
    expect(dbPosts[1].likes).toBe(350);
  });

  test("updates existing posts without duplicating", async () => {
    const initialPosts = [
      {
        postId: "post_id_1",
        caption: "Original Caption",
        postUrl: "https://instagram.com/p/post_id_1",
        postedAt: new Date("2026-06-10T12:00:00Z"),
        likes: 10,
        commentsCount: 1,
        hashtags: [],
        mentions: []
      }
    ];

    // Save initial
    await saveOrUpdatePosts("test_user_posts", initialPosts);

    // Verify it exists
    const initialDb = await Post.findOne({ postId: "post_id_1" });
    expect(initialDb).not.toBeNull();
    expect(initialDb!.caption).toBe("Original Caption");
    expect(initialDb!.likes).toBe(10);

    const updatedPosts = [
      {
        postId: "post_id_1",
        caption: "Updated Caption #news",
        postUrl: "https://instagram.com/p/post_id_1",
        postedAt: new Date("2026-06-10T12:00:00Z"),
        likes: 15,
        commentsCount: 2,
        hashtags: ["news"],
        mentions: []
      }
    ];

    // Update
    const result = await saveOrUpdatePosts("test_user_posts", updatedPosts);
    expect(result).not.toBeNull();
    expect(result!.modifiedCount).toBe(1);

    // Check count and contents
    const count = await Post.countDocuments({ postId: "post_id_1" });
    expect(count).toBe(1);

    const updatedDb = await Post.findOne({ postId: "post_id_1" });
    expect(updatedDb!.caption).toBe("Updated Caption #news");
    expect(updatedDb!.likes).toBe(15);
    expect(updatedDb!.hashtags).toEqual(["news"]);
  });
});
