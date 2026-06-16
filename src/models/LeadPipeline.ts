import mongoose, { Schema } from "mongoose";

export interface LeadPipelineNote {
  content: string;
  createdAt: Date;
}

export interface LeadPipelineAttrs {
  username: string;
  status: "new" | "contacted" | "interested" | "qualified" | "converted" | "lost";
  priority: "low" | "medium" | "high";
  assignedTo?: string;
  notes: LeadPipelineNote[];
  tags: string[];
  lastActivityAt: Date;
}

const leadPipelineSchema = new Schema<LeadPipelineAttrs>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["new", "contacted", "interested", "qualified", "converted", "lost"],
      default: "new",
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
      required: true,
      index: true,
    },
    assignedTo: {
      type: String,
      trim: true,
      index: true,
    },
    notes: [
      {
        content: {
          type: String,
          required: true,
          trim: true,
        },
        createdAt: {
          type: Date,
          required: true,
          default: Date.now,
        },
      },
    ],
    tags: {
      type: [String],
      required: true,
      default: [],
    },
    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const LeadPipeline =
  (mongoose.models.LeadPipeline as mongoose.Model<LeadPipelineAttrs> | undefined) ||
  mongoose.model<LeadPipelineAttrs>("LeadPipeline", leadPipelineSchema);
