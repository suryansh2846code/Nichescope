import mongoose, { Schema } from "mongoose";

export interface LeadScoreHistoryAttrs {
  username: string;
  leadScore: number;
  category: string;
  intent: string;
  recordedAt: Date;
}

const leadScoreHistorySchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    leadScore: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    intent: {
      type: String,
      required: true,
      trim: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

export const LeadScoreHistory =
  (mongoose.models.LeadScoreHistory as mongoose.Model<LeadScoreHistoryAttrs> | undefined) ||
  mongoose.model<LeadScoreHistoryAttrs>("LeadScoreHistory", leadScoreHistorySchema);
