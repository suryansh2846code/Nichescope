import mongoose, { Schema } from "mongoose";

export interface UserMonitoringAttrs {
  username: string;
  lastCheckedAt: Date;
  lastPostCount: number;
  lastPostIds: string[];
  monitoringEnabled: boolean;
  totalChecks: number;
  totalChangesDetected: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const userMonitoringSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    lastCheckedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastPostCount: {
      type: Number,
      required: true,
      default: 0,
    },
    lastPostIds: {
      type: [String],
      default: [],
    },
    monitoringEnabled: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    totalChecks: {
      type: Number,
      default: 0,
    },
    totalChangesDetected: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const UserMonitoring =
  (mongoose.models.UserMonitoring as mongoose.Model<UserMonitoringAttrs> | undefined) ||
  mongoose.model<UserMonitoringAttrs>("UserMonitoring", userMonitoringSchema);
