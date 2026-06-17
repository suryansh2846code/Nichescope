import mongoose, { Schema } from "mongoose";

export interface WorkerLogAttrs {
  workerName: string;
  message: string;
  level: "info" | "error" | "warn";
  timestamp: Date;
}

const workerLogSchema = new Schema(
  {
    workerName: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ["info", "error", "warn"],
      default: "info",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

export const WorkerLog =
  (mongoose.models.WorkerLog as mongoose.Model<WorkerLogAttrs> | undefined) ||
  mongoose.model<WorkerLogAttrs>("WorkerLog", workerLogSchema);
