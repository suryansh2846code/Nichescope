import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import {
  INFLUENCER_DISCOVERY_QUEUE_NAME,
  type InfluencerDiscoveryJobData,
  commentScrapeQueue,
  COMMENT_SCRAPE_JOB_NAME,
} from "../queues/commentQueues";
import { SeedInfluencer } from "../models/SeedInfluencer";
import { launchStealth, safeClose, collectRecentPostUrls } from "../scraper/instagram";
import { setupWorkerLogger } from "../utils/logger";

// Setup logging interceptor
setupWorkerLogger("influencer-discovery");

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in influencer discovery worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

const worker = new Worker<InfluencerDiscoveryJobData>(
  INFLUENCER_DISCOVERY_QUEUE_NAME,
  async (job) => {
    console.log(`Starting influencer discovery job ${job.id}`);
    
    const { username, niche: jobNiche, testScenario } = job.data || {};
    const POSTS_PER_RUN = 5;
    
    const scanInfluencer = async (cleanInfluencer: string, niche: string) => {
      if (testScenario === "influencer-private") {
        console.log(`Influencer @${cleanInfluencer} has private account (mock) — skipping`);
        return {
          influencerUsername: cleanInfluencer,
          niche,
          postsFound: 0,
          enqueuedCount: 0,
          status: "skipped" as const,
          reason: "private_account"
        };
      }

      if (testScenario === "influencer-no-posts") {
        console.log(`Influencer @${cleanInfluencer} has no posts (mock) — skipping`);
        return {
          influencerUsername: cleanInfluencer,
          niche,
          discoveredPostUrls: [],
          status: "success" as const
        };
      }

      if (testScenario === "influencer-success") {
        console.log(`Influencer @${cleanInfluencer} success mock — returning mock posts`);
        return {
          influencerUsername: cleanInfluencer,
          niche,
          discoveredPostUrls: [
            "https://www.instagram.com/p/mock-post-1/",
            "https://www.instagram.com/p/mock-post-2/",
          ],
          status: "success" as const
        };
      }

      let discoveredPostUrls: string[] = [];

      try {
        // Launch stealth browser, visit influencer profile
        const { browser, page, context } = await launchStealth();
        const profileUrl = `https://www.instagram.com/${cleanInfluencer}/`;
        
        try {
          await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          
          // Check if profile is private/doesn't exist
          const isPrivate = await page.evaluate(() => {
            const text = document.body.innerText;
            return text.includes("private") || text.includes("This account is private");
          });
          
          if (isPrivate) {
            console.log(`Influencer @${cleanInfluencer} has private account — skipping`);
            return {
              influencerUsername: cleanInfluencer,
              niche,
              postsFound: 0,
              enqueuedCount: 0,
              status: "skipped" as const,
              reason: "private_account"
            };
          }
          
          // Collect recent post URLs (reusing the helper)
          discoveredPostUrls = await collectRecentPostUrls(page, POSTS_PER_RUN);
          console.log(`Discovered ${discoveredPostUrls.length} post URLs for @${cleanInfluencer}`);
          
          return {
            influencerUsername: cleanInfluencer,
            niche,
            discoveredPostUrls,
            status: "success" as const
          };
        } finally {
          await safeClose(page, "page", 3000);
          await safeClose(context, "context", 3000);
          await safeClose(browser, "browser", 3000);
        }
      } catch (err) {
        console.error(
          `Failed to discover posts for @${cleanInfluencer}:`,
          err instanceof Error ? err.message : String(err)
        );
        throw err; // Let BullMQ retry
      }
    };

    let totalEnqueued = 0;

    if (username) {
      // Single influencer scan requested (usually via manual run or custom job)
      const cleanInfluencer = username.replace(/^@/, "").trim().toLowerCase();
      const niche = jobNiche || "general";
      const result = await scanInfluencer(cleanInfluencer, niche);
      
      if (result.status === "skipped") {
        await SeedInfluencer.updateOne(
          { username: cleanInfluencer },
          { $set: { isProcessed: true, isActive: false, processedAt: new Date(), updatedAt: new Date() } }
        );
        return result;
      }
      
      const urls = result.discoveredPostUrls || [];
      if (urls.length > 0) {
        const getPostId = (url: string) => {
          const match = url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
          return (match && match[1]) || url;
        };
        const latestPostId = getPostId(urls[0]!);
        
        await SeedInfluencer.updateOne(
          { username: cleanInfluencer },
          { 
            $set: { 
              lastProcessedPostId: latestPostId, 
              isProcessed: true, 
              isActive: false, 
              processedAt: new Date(),
              updatedAt: new Date() 
            } 
          }
        );

        for (const postUrl of urls) {
          const postId = getPostId(postUrl);
          const jobId = `comments-${postId}`;
          console.log(`Enqueuing comment scrape for post ${postId} (${postUrl})`);

          await commentScrapeQueue.add(
            COMMENT_SCRAPE_JOB_NAME,
            {
              postUrl,
              niche,
            },
            { jobId } // Deduplicates at BullMQ queue level
          );
          totalEnqueued++;
        }
      } else {
        // No posts found but still processed
        await SeedInfluencer.updateOne(
          { username: cleanInfluencer },
          { 
            $set: { 
              isProcessed: true, 
              isActive: false, 
              processedAt: new Date(),
              updatedAt: new Date() 
            } 
          }
        );
      }
      
      return {
        influencerUsername: cleanInfluencer,
        niche,
        postsFound: urls.length,
        enqueuedCount: totalEnqueued,
        status: "success"
      };
    } else {
      // Fetch active seed influencers from database
      const influencers = await SeedInfluencer.find({ isActive: true });
      console.log(`Found ${influencers.length} active seed influencers to scan.`);

      for (const influencer of influencers) {
        const cleanInfluencer = influencer.username.replace(/^@/, "").trim().toLowerCase();
        console.log(`Scanning seed influencer: @${cleanInfluencer} (niche: ${influencer.niche})`);
        
        try {
          const result = await scanInfluencer(cleanInfluencer, influencer.niche);
          if (result.status === "skipped") {
            influencer.isProcessed = true;
            influencer.isActive = false;
            influencer.processedAt = new Date();
            influencer.updatedAt = new Date();
            await influencer.save();
            continue;
          }
          
          const urls = result.discoveredPostUrls || [];
          if (urls.length > 0) {
            const getPostId = (url: string) => {
              const match = url.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
              return (match && match[1]) || url;
            };
            const latestPostId = getPostId(urls[0]!);
            
            influencer.lastProcessedPostId = latestPostId;
            influencer.isProcessed = true;
            influencer.isActive = false;
            influencer.processedAt = new Date();
            influencer.updatedAt = new Date();
            await influencer.save();

            for (const postUrl of urls) {
              const postId = getPostId(postUrl);
              const jobId = `comments-${postId}`;
              console.log(`Enqueuing comment scrape for post ${postId} (${postUrl})`);

              await commentScrapeQueue.add(
                COMMENT_SCRAPE_JOB_NAME,
                {
                  postUrl,
                  niche: influencer.niche,
                },
                { jobId } // Deduplicates at BullMQ queue level
              );
              totalEnqueued++;
            }
          } else {
            influencer.isProcessed = true;
            influencer.isActive = false;
            influencer.processedAt = new Date();
            influencer.updatedAt = new Date();
            await influencer.save();
          }
        } catch (err) {
          console.error(
            `Failed to discover posts for seed influencer @${cleanInfluencer}:`,
            err instanceof Error ? err.message : String(err)
          );
          // Don't fail the whole batch run, just continue to next influencer
        }
      }

      return {
        scannedInfluencersCount: influencers.length,
        enqueuedPostScrapesCount: totalEnqueued,
        status: "success",
      };
    }
  },
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Influencer discovery job ${job.id} completed successfully`);
});

worker.on("failed", (job, error) => {
  console.error(`Influencer discovery job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Influencer discovery worker listening on "${INFLUENCER_DISCOVERY_QUEUE_NAME}" queue`);
