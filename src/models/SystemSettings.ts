import mongoose, { Schema } from "mongoose";

export interface SystemSettingsAttrs {
  key: string;
  maxPostsScraped: number;
  maxHashtagPosts: number;
  maxCommentsScraped: number;
  followingBoostWeight: number;
  intentThreshold: number;
  immediateContactThreshold: number;
  aiProvider: string;
  geminiApiKey: string;
  openaiApiKey: string;
  openrouterApiKey: string;
  temperature: number;
  minLeadsRequired: number;
  commentScrapeTimeoutMs: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const systemSettingsSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    maxPostsScraped: {
      type: Number,
      default: 5,
    },
    maxHashtagPosts: {
      type: Number,
      default: 50,
    },
    maxCommentsScraped: {
      type: Number,
      default: 100,
    },
    followingBoostWeight: {
      type: Number,
      default: 30,
    },
    intentThreshold: {
      type: Number,
      default: 60,
    },
    immediateContactThreshold: {
      type: Number,
      default: 85,
    },
    aiProvider: {
      type: String,
      default: "gemini",
    },
    geminiApiKey: {
      type: String,
      default: "",
    },
    openaiApiKey: {
      type: String,
      default: "",
    },
    openrouterApiKey: {
      type: String,
      default: "",
    },
    temperature: {
      type: Number,
      default: 0.2,
    },
    minLeadsRequired: {
      type: Number,
      default: 10,
    },
    commentScrapeTimeoutMs: {
      type: Number,
      default: 120000,
    },
  },
  {
    timestamps: true,
  }
);

export const SystemSettings =
  (mongoose.models.SystemSettings as mongoose.Model<SystemSettingsAttrs> | undefined) ||
  mongoose.model<SystemSettingsAttrs>("SystemSettings", systemSettingsSchema);

export async function getSystemSettings(): Promise<SystemSettingsAttrs> {
  let settings = await SystemSettings.findOne({ key: "global" });
  if (!settings) {
    settings = await SystemSettings.create({ key: "global" });
  }
  return settings;
}
