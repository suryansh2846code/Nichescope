import mongoose, { Schema } from "mongoose";

export interface LeadQualificationAttrs {
  username: string;
  leadScore: number;
  problem: string;
  serviceNeeded: string;
  urgency: "low" | "medium" | "high";
  buyingIntent: number;
  confidence: number;
  qualificationReason: string;
  recommendedAction: string;
  supportingPosts: string[];
  category: string;
  intent: string;
  qualifiedAt: Date;
}

const leadQualificationSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    leadScore: {
      type: Number,
      required: true,
      index: true,
    },
    problem: {
      type: String,
      required: true,
      trim: true,
    },
    serviceNeeded: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    urgency: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
      index: true,
    },
    buyingIntent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    qualificationReason: {
      type: String,
      required: true,
      trim: true,
    },
    recommendedAction: {
      type: String,
      required: true,
      trim: true,
    },
    supportingPosts: {
      type: [String],
      required: true,
      default: [],
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
    },
    qualifiedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const LeadQualification =
  (mongoose.models.LeadQualification as mongoose.Model<LeadQualificationAttrs> | undefined) ||
  mongoose.model<LeadQualificationAttrs>("LeadQualification", leadQualificationSchema);
