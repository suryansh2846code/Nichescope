import mongoose, { Schema } from "mongoose";

export interface CategoryStat {
  category: string;
  count: number;
  positiveSentiment: number;
  neutralSentiment: number;
  negativeSentiment: number;
}

export interface IntentStat {
  intent: string;
  count: number;
}

export interface KeywordStat {
  keyword: string;
  count: number;
}

export interface MentionStat {
  mention: string;
  count: number;
}

export interface MarketSnapshotAttrs {
  snapshotDate: Date;
  categoryStats: CategoryStat[];
  intentStats: IntentStat[];
  keywordStats: KeywordStat[];
  topMentions: MentionStat[];
  totalUsers: number;
  totalPosts: number;
}

const marketSnapshotSchema = new Schema(
  {
    snapshotDate: {
      type: Date,
      required: true,
      unique: true,
      index: true,
    },
    categoryStats: [
      {
        category: { type: String, required: true, trim: true },
        count: { type: Number, required: true },
        positiveSentiment: { type: Number, required: true, default: 0 },
        neutralSentiment: { type: Number, required: true, default: 0 },
        negativeSentiment: { type: Number, required: true, default: 0 },
      },
    ],
    intentStats: [
      {
        intent: { type: String, required: true, trim: true },
        count: { type: Number, required: true },
      },
    ],
    keywordStats: [
      {
        keyword: { type: String, required: true, trim: true },
        count: { type: Number, required: true },
      },
    ],
    topMentions: [
      {
        mention: { type: String, required: true, trim: true },
        count: { type: Number, required: true },
      },
    ],
    totalUsers: {
      type: Number,
      required: true,
    },
    totalPosts: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const MarketSnapshot =
  (mongoose.models.MarketSnapshot as mongoose.Model<MarketSnapshotAttrs> | undefined) ||
  mongoose.model<MarketSnapshotAttrs>("MarketSnapshot", marketSnapshotSchema);
