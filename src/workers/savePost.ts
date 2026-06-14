import { Post } from "../models/Post";
import type { ScrapedPost } from "../scraper/instagram";

export async function saveOrUpdatePosts(
  username: string,
  posts: ScrapedPost[]
) {
  const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();

  const operations = posts.map((post) => ({
    updateOne: {
      filter: { postId: post.postId },
      update: {
        $set: {
          username: cleanUsername,
          caption: post.caption,
          postUrl: post.postUrl,
          hashtags: post.hashtags,
          mentions: post.mentions,
          postedAt: post.postedAt,
          likes: post.likes !== undefined ? post.likes : null,
          commentsCount: post.commentsCount !== undefined ? post.commentsCount : null,
          scrapedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    const result = await Post.bulkWrite(operations);
    console.log(
      `Saved posts for @${cleanUsername}: upserted ${result.upsertedCount}, modified ${result.modifiedCount}`
    );
    return result;
  }

  return null;
}
