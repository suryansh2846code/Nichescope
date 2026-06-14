import mongoose, { Schema } from "mongoose";

export interface HashtagDiscoveryAttrs {
  hashtag: string;
  username: string;
  discoveredAt: Date;
  sourcePostUrl?: string;
}

const hashtagDiscoverySchema = new Schema(
  {
    hashtag: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    discoveredAt: {
      type: Date,
      default: Date.now,
    },
    sourcePostUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate discoveries
hashtagDiscoverySchema.index({ hashtag: 1, username: 1 }, { unique: true });

export const HashtagDiscovery =
  (mongoose.models.HashtagDiscovery as mongoose.Model<HashtagDiscoveryAttrs> | undefined) ||
  mongoose.model<HashtagDiscoveryAttrs>("HashtagDiscovery", hashtagDiscoverySchema);
