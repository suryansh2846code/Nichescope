import mongoose, { Schema } from "mongoose";

export interface TrendEventAttrs {
  type: string;
  entity: string;
  oldValue: number;
  newValue: number;
  growthRate: number;
  detectedAt: Date;
}

const trendEventSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    entity: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    oldValue: {
      type: Number,
      required: true,
    },
    newValue: {
      type: Number,
      required: true,
    },
    growthRate: {
      type: Number,
      required: true,
    },
    detectedAt: {
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

export const TrendEvent =
  (mongoose.models.TrendEvent as mongoose.Model<TrendEventAttrs> | undefined) ||
  mongoose.model<TrendEventAttrs>("TrendEvent", trendEventSchema);
