import Redis from "ioredis";
import { createRedisConnectionOptions } from "../../queues/redis";
import { DiscoverySession } from "../../models/DiscoverySession";

class DiscoveryEventEmitter {
  private publisher: Redis;

  constructor() {
    const redisOptions = createRedisConnectionOptions();
    this.publisher = new Redis(redisOptions);

    this.publisher.on("error", (err) => {
      console.error("DiscoveryEventEmitter Redis Publisher Error:", err);
    });
  }

  /**
   * Emits a real-time event, persists it to the database, and publishes it via Redis.
   */
  async emit(sessionId: string, type: string, data: any) {
    if (!sessionId) {
      console.warn(`[DiscoveryEmitter] Event emitted without sessionId: type=${type}`);
      return;
    }

    const timestamp = new Date();
    const eventPayload = {
      type,
      data,
      timestamp,
    };

    console.log(`[DiscoveryEmitter] Emitting event: session=${sessionId}, type=${type}`);

    try {
      // 1. Update the database session document
      const updateQuery: any = {
        $push: { events: eventPayload },
      };

      // Perform state/stats increments based on the event type
      if (type === "posts_found") {
        const postsCount = Array.isArray(data.posts) ? data.posts.length : 0;
        updateQuery.$set = { "stats.postsFound": postsCount };
      } else if (type === "comments_extracted") {
        const commentsCount = Number(data.commentCount || 0);
        updateQuery.$inc = { "stats.postsScraped": 1 };
        if (commentsCount > 0) {
          updateQuery.$inc["stats.commentsExtracted"] = commentsCount;
        }
      } else if (type === "comment_analyzed") {
        updateQuery.$inc = { "stats.commentsAnalyzed": 1 };
        if (data.isLead) {
          updateQuery.$inc["stats.commentsQualified"] = 1;
        }
      } else if (type === "lead_created") {
        updateQuery.$inc = { "stats.leadsCreated": 1 };
      } else if (type === "completed" || type === "stage_complete") {
        updateQuery.$set = { status: "completed", completedAt: timestamp };
      } else if (type === "already_scanned") {
        updateQuery.$set = { status: "already_scanned", completedAt: timestamp };
      } else if (type === "error" || type === "failed") {
        updateQuery.$set = { status: "failed", completedAt: timestamp };
      } else if (type === "paused") {
        updateQuery.$set = { status: "paused" };
      } else if (type === "resumed") {
        updateQuery.$set = { status: "running" };
      } else if (type === "cancelled") {
        updateQuery.$set = { status: "cancelled", completedAt: timestamp };
      }

      // Upsert and retrieve updated session doc
      const session = await DiscoverySession.findOneAndUpdate({ sessionId }, updateQuery, {
        upsert: true,
        new: true,
      });

      // 2. Check for auto-completion (if all posts scraped and comments analyzed)
      if (session && session.status === "running") {
        const s = session.stats;
        if (
          s.postsScraped >= s.postsFound &&
          s.commentsAnalyzed >= s.commentsExtracted &&
          s.postsFound > 0
        ) {
          session.status = "completed";
          session.completedAt = new Date();
          await session.save();

          const completePayload = {
            type: "completed",
            data: { message: "Discovery session finished processing all items." },
            timestamp: new Date(),
          };

          // Persist the completed event to the session
          await DiscoverySession.updateOne(
            { sessionId },
            { $push: { events: completePayload } }
          );

          await this.publisher.publish(`discovery:${sessionId}`, JSON.stringify(completePayload));
          console.log(`[DiscoveryEmitter] Session completed: ${sessionId}`);
        }
      }

      // 3. Publish to Redis Pub/Sub for real-time WebSocket distribution
      const channel = `discovery:${sessionId}`;
      await this.publisher.publish(channel, JSON.stringify(eventPayload));
    } catch (err) {
      console.error(`[DiscoveryEmitter] Error persisting or publishing event:`, err);
    }
  }

  async close() {
    await this.publisher.quit();
  }
}

export async function checkDiscoverySessionState(sessionId: string | undefined): Promise<boolean> {
  if (!sessionId) return true;

  while (true) {
    const session = await DiscoverySession.findOne({ sessionId });
    if (!session) {
      return true; // Proceed if session is not yet registered
    }

    if (
      session.status === "failed" ||
      session.status === "completed" ||
      session.status === "cancelled" ||
      session.status === "already_scanned"
    ) {
      console.log(`[DiscoveryControl] Session ${sessionId} is terminated with status "${session.status}". Discarding current job.`);
      return false; // Stop processing
    }

    if (session.status === "paused") {
      console.log(`[DiscoveryControl] Session ${sessionId} is paused. Waiting...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    return true; // Session is running, proceed
  }
}

export const discoveryEmitter = new DiscoveryEventEmitter();
