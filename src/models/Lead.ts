import mongoose, { Schema } from "mongoose";

export interface LeadAttrs {
  username: string;
  fullName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  profileUrl: string;
  contactEmail?: string;
  foundVia: string;
  niche: string;
  scrapedAt: Date;
  rawData: unknown;
  followingHandles?: string[];
  followingBoost?: number;
  followingOverlapCount?: number;
  matchedSeedInfluencers?: string[];
}

const leadSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
    },
    followerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    profileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
    },
    foundVia: {
      type: String,
      required: true,
      trim: true,
    },
    niche: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    scrapedAt: {
      type: Date,
      default: Date.now,
    },
    rawData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    followingHandles: {
      type: [String],
      default: [],
    },
    followingBoost: {
      type: Number,
      default: 0,
    },
    followingOverlapCount: {
      type: Number,
      default: 0,
    },
    matchedSeedInfluencers: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const Lead =
  (mongoose.models.Lead as mongoose.Model<LeadAttrs> | undefined) ||
  mongoose.model<LeadAttrs>("Lead", leadSchema);
