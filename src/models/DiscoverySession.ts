import mongoose, { Schema } from "mongoose";

export interface DiscoveryEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export interface DiscoverySessionAttrs {
  sessionId: string;
  username: string;
  niche: string;
  status: "running" | "paused" | "cancelled" | "completed" | "failed";
  stats: {
    postsFound: number;
    postsScraped: number;
    commentsExtracted: number;
    commentsAnalyzed: number;
    commentsQualified: number;
    leadsCreated: number;
  };
  events: DiscoveryEvent[];
  startedAt: Date;
  completedAt?: Date;
}

const discoveryEventSchema = new Schema({
  type: {
    type: String,
    required: true,
  },
  data: {
    type: Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const discoverySessionSchema = new Schema(
  {
    sessionId: {
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
    niche: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["running", "paused", "cancelled", "completed", "failed"],
      default: "running",
      index: true,
    },
    stats: {
      postsFound: { type: Number, default: 0 },
      postsScraped: { type: Number, default: 0 },
      commentsExtracted: { type: Number, default: 0 },
      commentsAnalyzed: { type: Number, default: 0 },
      commentsQualified: { type: Number, default: 0 },
      leadsCreated: { type: Number, default: 0 },
    },
    events: [discoveryEventSchema],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const DiscoverySession =
  (mongoose.models.DiscoverySession as mongoose.Model<DiscoverySessionAttrs> | undefined) ||
  mongoose.model<DiscoverySessionAttrs>("DiscoverySession", discoverySessionSchema);
