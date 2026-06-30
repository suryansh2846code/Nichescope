import mongoose, { Schema } from "mongoose";

export interface CommentAnalysisAttrs {
  username: string;
  commentText: string;
  postUrl: string;
  intentScore: number;
  isLead: boolean;
  niche: string;
  analyzedAt: Date;
  category?: string;
  intent?: string;
  sessionId?: string;
}

const commentAnalysisSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    commentText: {
      type: String,
      required: true,
      trim: true,
    },
    postUrl: {
      type: String,
      required: true,
      trim: true,
    },
    intentScore: {
      type: Number,
      required: true,
      default: 0,
    },
    isLead: {
      type: Boolean,
      required: true,
      default: false,
    },
    niche: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
    },
    intent: {
      type: String,
      trim: true,
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
    },
    sessionId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const CommentAnalysis =
  (mongoose.models.CommentAnalysis as mongoose.Model<CommentAnalysisAttrs> | undefined) ||
  mongoose.model<CommentAnalysisAttrs>("CommentAnalysis", commentAnalysisSchema);
