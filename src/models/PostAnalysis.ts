import mongoose, { Schema } from "mongoose";

export interface PostAnalysisAttrs {
  postId: string;
  username: string;
  isLead: boolean;
  category: string;
  intent: string;
  confidence: number;
  leadScore: number;
  extractedKeywords: string[];
  summary: string;
  analyzedAt: Date;
}

const postAnalysisSchema = new Schema(
  {
    postId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    isLead: {
      type: Boolean,
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    intent: {
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
    extractedKeywords: [
      {
        type: String,
        trim: true,
      },
    ],
    summary: {
      type: String,
      required: true,
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const PostAnalysis =
  (mongoose.models.PostAnalysis as mongoose.Model<PostAnalysisAttrs> | undefined) ||
  mongoose.model<PostAnalysisAttrs>("PostAnalysis", postAnalysisSchema);
