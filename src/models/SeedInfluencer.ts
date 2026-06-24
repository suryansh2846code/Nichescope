import mongoose, { Schema } from "mongoose";

export interface SeedInfluencerAttrs {
  username: string;
  niche: string;
  isActive: boolean;
  lastProcessedPostId?: string;
  isProcessed?: boolean;
  processedAt?: Date;
  updatedAt: Date;
}

const seedInfluencerSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    niche: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastProcessedPostId: {
      type: String,
      trim: true,
    },
    isProcessed: {
      type: Boolean,
      default: false,
      index: true,
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const SeedInfluencer =
  (mongoose.models.SeedInfluencer as mongoose.Model<SeedInfluencerAttrs> | undefined) ||
  mongoose.model<SeedInfluencerAttrs>("SeedInfluencer", seedInfluencerSchema);
