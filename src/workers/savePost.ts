import { Post } from "../models/Post";
import type { ScrapedPost } from "../scraper/instagram";
import { analysisQueue, ANALYZE_POST_JOB_NAME } from "../queues/analysisQueue";

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

    // Fetch and enqueue unanalyzed posts that have captions
    try {
      const unanalyzedPosts = await Post.find({
        username: cleanUsername,
        caption: { $ne: "" },
        $or: [{ isAnalyzed: false }, { isAnalyzed: { $exists: false } }],
      });

      console.log(`Found ${unanalyzedPosts.length} unanalyzed posts for @${cleanUsername}. Enqueuing to AI pipeline...`);

      for (const post of unanalyzedPosts) {
        await analysisQueue.add(
          ANALYZE_POST_JOB_NAME,
          {
            postId: post.postId,
            username: post.username,
            caption: post.caption,
          },
          { jobId: post.postId } // Deduplicate jobs on Redis by using unique postId as jobId
        );
      }
    } catch (err) {
      console.error(
        `Failed to enqueue unanalyzed posts for @${cleanUsername} to analysis queue:`,
        err instanceof Error ? err.message : String(err)
      );
    }

    return result;
  }

  return null;
}
