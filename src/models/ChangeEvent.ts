import mongoose, { Schema } from "mongoose";

export interface ChangeEventAttrs {
  username: string;
  changeType: string;
  oldValue?: string;
  newValue?: string;
  delta?: number;
  detectedAt: Date;
}

const changeEventSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    changeType: {
      type: String,
      required: true,
      trim: true,
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
    delta: {
      type: Number,
    },
    detectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

export const ChangeEvent =
  (mongoose.models.ChangeEvent as mongoose.Model<ChangeEventAttrs> | undefined) ||
  mongoose.model<ChangeEventAttrs>("ChangeEvent", changeEventSchema);
