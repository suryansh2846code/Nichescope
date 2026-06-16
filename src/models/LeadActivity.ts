import mongoose, { Schema } from "mongoose";

export interface LeadActivityAttrs {
  username: string;
  type: "created" | "status_changed" | "note_added" | "assigned" | "lead_score_changed" | "converted" | "lost";
  oldValue?: string;
  newValue?: string;
  createdAt: Date;
}

const leadActivitySchema = new Schema<LeadActivityAttrs>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["created", "status_changed", "note_added", "assigned", "lead_score_changed", "converted", "lost"],
      required: true,
      index: true,
    },
    oldValue: {
      type: String,
      trim: true,
    },
    newValue: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const LeadActivity =
  (mongoose.models.LeadActivity as mongoose.Model<LeadActivityAttrs> | undefined) ||
  mongoose.model<LeadActivityAttrs>("LeadActivity", leadActivitySchema);
