import mongoose, { Schema } from "mongoose";

export interface UserIntelligenceAttrs {
  username: string;
  overallCategory: string;
  overallIntent: string;
  confidence: number;
  leadScore: number;
  summary: string;
  postCountAnalyzed: number;
  leadPostCount: number;
  categories: {
    category: string;
    count: number;
  }[];
  intents: {
    intent: string;
    count: number;
  }[];
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  analyzedAt: Date;
}

const userIntelligenceSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    overallCategory: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    overallIntent: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    confidence: {
      type: Number,
      required: true,
    },
    leadScore: {
      type: Number,
      required: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
      maxlength: 250,
    },
    postCountAnalyzed: {
      type: Number,
      required: true,
    },
    leadPostCount: {
      type: Number,
      required: true,
    },
    categories: [
      {
        category: { type: String, required: true, trim: true },
        count: { type: Number, required: true },
      },
    ],
    intents: [
      {
        intent: { type: String, required: true, trim: true },
        count: { type: Number, required: true },
      },
    ],
    firstSeenAt: {
      type: Date,
    },
    lastSeenAt: {
      type: Date,
    },
    analyzedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const UserIntelligence =
  (mongoose.models.UserIntelligence as mongoose.Model<UserIntelligenceAttrs> | undefined) ||
  mongoose.model<UserIntelligenceAttrs>("UserIntelligence", userIntelligenceSchema);
