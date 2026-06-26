import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { USER_INTELLIGENCE_QUEUE_NAME, type UserIntelligenceJobData } from "../queues/userIntelligenceQueue";
import { PostAnalysis } from "../models/PostAnalysis";
import { Post } from "../models/Post";
import { UserIntelligence } from "../models/UserIntelligence";
import { getAIProvider } from "../services/ai/AIProvider";
import { LeadScoreHistory } from "../models/LeadScoreHistory";
import { ChangeEvent } from "../models/ChangeEvent";
import { UserMonitoring } from "../models/UserMonitoring";
import { leadQualificationQueue, QUALIFY_LEAD_JOB_NAME } from "../queues/leadQualificationQueue";
import { setupWorkerLogger } from "../utils/logger";
import { Lead } from "../models/Lead";
import { analyzeFollowingList } from "../services/following/followingAnalysisService";
import { CommentAnalysis } from "../models/CommentAnalysis";

import { checkDiscoverySessionState } from "../services/discovery/discoveryEventEmitter";

setupWorkerLogger("intelligence");


// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in User Intelligence worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}



export async function processUserIntelligenceJob(job: {
  data: UserIntelligenceJobData;
  updateProgress: (progress: number) => Promise<any>;
}) {
  const { username, sessionId } = (job.data as any) || {};
  
  const shouldProceed = await checkDiscoverySessionState(sessionId);
  if (!shouldProceed) return;

  const provider = getAIProvider();
  const normalizedUser = (username || "").toLowerCase().trim();
  console.log(`Starting User Intelligence aggregation for @${normalizedUser}`);
  await job.updateProgress(10);

  // 1. Load all PostAnalysis records for user
  const analyses = await PostAnalysis.find({ username: normalizedUser });
  
  // Also load all CommentAnalysis records for this user
  const commentAnalyses = await CommentAnalysis.find({ username: normalizedUser, isLead: true });

  if (analyses.length === 0 && commentAnalyses.length === 0) {
    console.log(`No post or comment analyses found for @${normalizedUser}. Skipping user aggregation.`);
    await job.updateProgress(100);
    return { username: normalizedUser, status: "skipped", reason: "no_analyses" };
  }
  await job.updateProgress(30);

  // 2. Fetch corresponding Posts to get captions and timestamps
  const postIds = analyses.map((a) => a.postId);
  const posts = await Post.find({ postId: { $in: postIds } });
  const postsMap = new Map(posts.map((p) => [p.postId, p]));

  // 3. Aggregate category and intent distributions
  const categoryCounts: Record<string, number> = {};
  const intentCounts: Record<string, number> = {};
  let totalConfidence = 0;
  let totalPostLeadScore = 0;
  let leadPostCount = 0;

  for (const analysis of analyses) {
    // Category distribution
    const cat = analysis.category || "general";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    // Intent distribution
    const intent = analysis.intent || "other";
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;

    totalConfidence += analysis.confidence || 0;
    totalPostLeadScore += analysis.leadScore || 0;
    if (analysis.isLead) {
      leadPostCount++;
    }
  }

  for (const comment of commentAnalyses) {
    const cat = comment.category || comment.niche || "general";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    const intent = comment.intent || "seeking_recommendation";
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;

    totalConfidence += comment.intentScore || 0;
    totalPostLeadScore += comment.intentScore || 0;
  }

  // Determine dominant overallCategory and overallIntent
  const categoriesList = Object.entries(categoryCounts).map(([category, count]) => ({
    category,
    count,
  }));
  categoriesList.sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  const overallCategory = categoriesList[0]?.category || "general";

  const intentsList = Object.entries(intentCounts).map(([intent, count]) => ({
    intent,
    count,
  }));
  intentsList.sort((a, b) => b.count - a.count || a.intent.localeCompare(b.intent));
  const overallIntent = intentsList[0]?.intent || "other";

  const totalItems = analyses.length + commentAnalyses.length;
  const averageConfidence = totalConfidence / totalItems;
  const averagePostLeadScore = totalPostLeadScore / totalItems;

  await job.updateProgress(50);

  // 4. Lead Score Calculation
  // let score = 0;
  // score += averagePostLeadScore * 0.5;
  // if (leadPostCount >= 3) {
  //   score += 20;
  // }
  // if (overallIntent === "seeking_help" || overallIntent === "seeking_recommendation") {
  //   score += 15;
  // }
  // if (averageConfidence > 90) {
  //   score += 15;
  // }
  // const finalLeadScore = Math.max(0, Math.min(100, Math.round(score)));

  let score = 0;
  score += averagePostLeadScore * 0.5;
  if (leadPostCount >= 3) {
    score += 20;
  }
  if (overallIntent === "seeking_help" || overallIntent === "seeking_recommendation") {
    score += 15;
  }
  if (averageConfidence > 90) {
    score += 15;
  }

  let followingBoost = 0;
  try {
    const lead = await Lead.findOne({ username: normalizedUser });
    if (lead && lead.followingHandles && lead.followingHandles.length > 0) {
      const analysis = await analyzeFollowingList(lead.followingHandles, lead.niche);
      followingBoost = analysis.followingBoost;
    }
  } catch (err) {
    console.error(`Failed to calculate following boost for @${normalizedUser}:`, err);
  }

  score += followingBoost;
  const finalLeadScore = Math.max(0, Math.min(100, Math.round(score)));

  // 5. Generate AI User Summary
  // Sort posts by date to get most recent ones first
  const sortedAnalyses = [...analyses].sort((a, b) => {
    const pA = postsMap.get(a.postId);
    const pB = postsMap.get(b.postId);
    const dA = pA?.postedAt || a.analyzedAt || (a as any).createdAt || new Date(0);
    const dB = pB?.postedAt || b.analyzedAt || (b as any).createdAt || new Date(0);
    return new Date(dB).getTime() - new Date(dA).getTime(); // Newest first
  });

  // Extract captions for AI summary (up to 10 most recent posts, truncated to 300 chars)
  const summaryInputs: string[] = [];
  for (const analysis of sortedAnalyses.slice(0, 10)) {
    const post = postsMap.get(analysis.postId);
    const captionText = post?.caption || analysis.summary || "";
    if (captionText.trim()) {
      summaryInputs.push(captionText.slice(0, 300).trim());
    }
  }

  // Also extract lead comment text for context in AI summary
  for (const comment of commentAnalyses.slice(0, 5)) {
    if (comment.commentText.trim()) {
      summaryInputs.push(`Lead Comment: "${comment.commentText.slice(0, 300).trim()}"`);
    }
  }

  // Call AI provider
  const summary = await provider.generateUserSummary(summaryInputs);
  await job.updateProgress(80);

  // 6. Determine firstSeenAt and lastSeenAt
  let firstSeenAt: Date | undefined;
  let lastSeenAt: Date | undefined;

  const dates = [
    ...analyses
      .map((a) => {
        const post = postsMap.get(a.postId);
        return post?.postedAt || a.analyzedAt || (a as any).createdAt;
      }),
    ...commentAnalyses.map((c) => c.analyzedAt || (c as any).createdAt)
  ]
    .filter(Boolean)
    .map((d) => new Date(d));

  if (dates.length > 0) {
    firstSeenAt = new Date(Math.min(...dates.map((d) => d.getTime())));
    lastSeenAt = new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  // 7. Load old UserIntelligence for change detection
  const oldIntel = await UserIntelligence.findOne({ username: normalizedUser });

  // 8. Save or Update UserIntelligence
  const userIntel = await UserIntelligence.findOneAndUpdate(
    { username: normalizedUser },
    {
      username: normalizedUser,
      overallCategory,
      overallIntent,
      confidence: averageConfidence,
      leadScore: finalLeadScore,
      summary: summary.slice(0, 250), // Ensure strict 250 character limit
      postCountAnalyzed: analyses.length,
      leadPostCount,
      categories: categoriesList,
      intents: intentsList,
      firstSeenAt,
      lastSeenAt,
      analyzedAt: new Date(),
    },
    { upsert: true, returnDocument: "after" }
  );

  // 9. Run change detection logic
  try {
    if (oldIntel) {
      // Compare lead score increase
      if (finalLeadScore > oldIntel.leadScore) {
        const delta = finalLeadScore - oldIntel.leadScore;
        await ChangeEvent.create({
          username: normalizedUser,
          changeType: "lead_score_increase",
          oldValue: String(oldIntel.leadScore),
          newValue: String(finalLeadScore),
          delta,
          detectedAt: new Date(),
        });
        console.log(`Detected Lead Score Increase for @${normalizedUser}: +${delta}`);
      }

      // Compare category change
      if (overallCategory !== oldIntel.overallCategory) {
        await ChangeEvent.create({
          username: normalizedUser,
          changeType: "category_change",
          oldValue: oldIntel.overallCategory,
          newValue: overallCategory,
          detectedAt: new Date(),
        });
        console.log(`Detected Category Shift for @${normalizedUser}: ${oldIntel.overallCategory} -> ${overallCategory}`);
      }

      // Compare intent change
      if (overallIntent !== oldIntel.overallIntent) {
        await ChangeEvent.create({
          username: normalizedUser,
          changeType: "intent_change",
          oldValue: oldIntel.overallIntent,
          newValue: overallIntent,
          detectedAt: new Date(),
        });
        console.log(`Detected Intent Shift for @${normalizedUser}: ${oldIntel.overallIntent} -> ${overallIntent}`);
      }
    }

    // Always log LeadScoreHistory snapshot
    await LeadScoreHistory.create({
      username: normalizedUser,
      leadScore: finalLeadScore,
      category: overallCategory,
      intent: overallIntent,
      recordedAt: new Date(),
    });

    // Automatically initialize UserMonitoring with default true if not exists yet
    const existingMonitor = await UserMonitoring.findOne({ username: normalizedUser });
    if (!existingMonitor) {
      await UserMonitoring.create({
        username: normalizedUser,
        lastCheckedAt: new Date(),
        lastPostCount: posts.length,
        lastPostIds: posts.map((p) => p.postId),
        monitoringEnabled: true,
        totalChecks: 1,
        totalChangesDetected: 0,
      });
      console.log(`Initialized UserMonitoring configuration for @${normalizedUser}`);
    }
  } catch (err) {
    console.error(
      `Error in change detection logic for @${normalizedUser}:`,
      err instanceof Error ? err.message : String(err)
    );
  }

  // 10. Enqueue lead qualification job
  try {
    await leadQualificationQueue.add(
      QUALIFY_LEAD_JOB_NAME,
      { username: normalizedUser, sessionId },
      { jobId: normalizedUser }
    );
    console.log(`Enqueued LeadQualification for user @${normalizedUser}`);
  } catch (err) {
    console.error(
      `Failed to enqueue lead qualification job for @${normalizedUser}:`,
      err instanceof Error ? err.message : String(err)
    );
  }

  await job.updateProgress(100);
  console.log(
    `Finished User Intelligence aggregation for @${normalizedUser}. Score: ${finalLeadScore}, Dominant Category: ${overallCategory}`
  );

  return {
    username: normalizedUser,
    overallCategory,
    overallIntent,
    leadScore: finalLeadScore,
    status: "success",
  };
}

const worker = new Worker<UserIntelligenceJobData>(
  USER_INTELLIGENCE_QUEUE_NAME,
  processUserIntelligenceJob,
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`User Intelligence aggregation job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`User Intelligence aggregation job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`User Intelligence worker listening on "${USER_INTELLIGENCE_QUEUE_NAME}" queue`);
