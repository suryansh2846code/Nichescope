import { Worker } from "bullmq";
import { connectToDatabase } from "../db";
import { createRedisConnectionOptions } from "../queues/redis";
import { LEAD_QUALIFICATION_QUEUE_NAME, type LeadQualificationJobData } from "../queues/leadQualificationQueue";
import { UserIntelligence } from "../models/UserIntelligence";
import { Post } from "../models/Post";
import { PostAnalysis } from "../models/PostAnalysis";
import { LeadQualification } from "../models/LeadQualification";
import { getAIProvider } from "../services/ai/AIProvider";
import { LeadPipeline } from "../models/LeadPipeline";
import { LeadActivity } from "../models/LeadActivity";
import { setupWorkerLogger } from "../utils/logger";

setupWorkerLogger("qualification");

// Connect to MongoDB
try {
  await connectToDatabase();
} catch (error) {
  console.error(
    `Failed to connect to MongoDB in Lead Qualification worker: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

export async function processLeadQualificationJob(job: {
  data: LeadQualificationJobData;
  updateProgress: (progress: number) => Promise<any>;
}) {
  const provider = getAIProvider();
  const { username } = job.data;
  const normalizedUser = username.toLowerCase().trim();
  console.log(`Starting Lead Qualification aggregation for @${normalizedUser}`);
  await job.updateProgress(10);

  // 1. Load UserIntelligence
  const userIntel = await UserIntelligence.findOne({ username: normalizedUser });
  if (!userIntel) {
    console.log(`No UserIntelligence found for @${normalizedUser}. Skipping qualification.`);
    await job.updateProgress(100);
    return { username: normalizedUser, status: "skipped", reason: "no_user_intelligence" };
  }
  await job.updateProgress(30);

  // 2. Load recent post captions for context
  const posts = await Post.find({ username: normalizedUser })
    .sort({ postedAt: -1, scrapedAt: -1, createdAt: -1 })
    .limit(10);
  const captions = posts.map((p) => p.caption).filter(Boolean) as string[];

  // 3. Qualify lead using AI provider
  const result = await provider.qualifyLead(
    normalizedUser,
    userIntel.summary,
    userIntel.overallCategory,
    userIntel.overallIntent,
    userIntel.leadScore,
    captions
  );
  await job.updateProgress(70);

  // 4. Determine recommendedAction based on buyingIntent
  // - buyingIntent > 85 -> "Contact immediately"
  // - buyingIntent > 60 -> "Monitor"
  // - else -> "Low priority"
  let recommendedAction = "Low priority";
  if (result.buyingIntent > 85) {
    recommendedAction = "Contact immediately";
  } else if (result.buyingIntent > 60) {
    recommendedAction = "Monitor";
  }

  // 5. Gather supporting posts (post URLs for the user where isLead is true in PostAnalysis)
  const analyses = await PostAnalysis.find({ username: normalizedUser, isLead: true });
  const postIds = analyses.map((a) => a.postId);
  const leadPosts = await Post.find({ postId: { $in: postIds } });
  const supportingPosts = leadPosts.map((p) => p.postUrl).filter(Boolean);

  // Fetch any existing LeadQualification to compare scores for automation
  const oldQual = await LeadQualification.findOne({ username: normalizedUser });

  // 6. Save or Update LeadQualification
  await LeadQualification.findOneAndUpdate(
    { username: normalizedUser },
    {
      username: normalizedUser,
      leadScore: userIntel.leadScore,
      problem: result.problem,
      serviceNeeded: result.serviceNeeded,
      urgency: result.urgency,
      buyingIntent: result.buyingIntent,
      confidence: result.confidence,
      qualificationReason: result.qualificationReason,
      recommendedAction,
      supportingPosts,
      category: userIntel.overallCategory,
      intent: userIntel.overallIntent,
      qualifiedAt: new Date(),
    },
    { upsert: true, returnDocument: "after" }
  );

  // 7. CRM initialization and automation hooks
  try {
    let targetPriority: "low" | "medium" | "high" = "low";
    if (result.buyingIntent > 85) {
      targetPriority = "high";
    } else if (result.buyingIntent > 60) {
      targetPriority = "medium";
    }

    const existingPipeline = await LeadPipeline.findOne({ username: normalizedUser });
    if (!existingPipeline) {
      // Create new LeadPipeline with default status 'new' and calculated priority
      await LeadPipeline.create({
        username: normalizedUser,
        status: "new",
        priority: targetPriority,
        notes: [],
        tags: [],
        lastActivityAt: new Date(),
      });

      // Record 'created' LeadActivity
      await LeadActivity.create({
        username: normalizedUser,
        type: "created",
        newValue: "new",
        createdAt: new Date(),
      });
      console.log(`Initialized CRM LeadPipeline for @${normalizedUser} with status new and priority ${targetPriority}`);
    } else {
      // Automate priority escalation when lead score increases significantly (>= 20 points)
      if (oldQual) {
        const oldScore = oldQual.leadScore || 0;
        const newScore = userIntel.leadScore || 0;
        if (newScore - oldScore >= 20) {
          existingPipeline.priority = "high";
          existingPipeline.lastActivityAt = new Date();
          await existingPipeline.save();

          // Record 'lead_score_changed' LeadActivity
          await LeadActivity.create({
            username: normalizedUser,
            type: "lead_score_changed",
            oldValue: String(oldScore),
            newValue: String(newScore),
            createdAt: new Date(),
          });
          console.log(`CRM automation triggered: lead score increased significantly (+${newScore - oldScore}) for @${normalizedUser}. priority -> high.`);
        }
      }
    }
  } catch (err) {
    console.error(
      `Error in CRM initialization/automation for @${normalizedUser}:`,
      err instanceof Error ? err.message : String(err)
    );
  }

  await job.updateProgress(100);
  console.log(
    `Finished Lead Qualification for @${normalizedUser}. Urgency: ${result.urgency}, Action: ${recommendedAction}`
  );

  return {
    username: normalizedUser,
    status: "success",
    urgency: result.urgency,
    recommendedAction,
  };
}

const worker = new Worker<LeadQualificationJobData>(
  LEAD_QUALIFICATION_QUEUE_NAME,
  processLeadQualificationJob,
  {
    connection: createRedisConnectionOptions(),
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Lead Qualification job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Lead Qualification job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log(`Lead Qualification worker listening on "${LEAD_QUALIFICATION_QUEUE_NAME}" queue`);
