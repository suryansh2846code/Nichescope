import mongoose, { Schema } from "mongoose";

export interface PostAttrs {
  username: string;
  postId: string;
  caption: string;
  postUrl: string;
  hashtags: string[];
  mentions: string[];
  postedAt?: Date;
  likes?: number | null;
  commentsCount?: number | null;
  isAnalyzed?: boolean;
  scrapedAt: Date;
}

const postSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    postId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    caption: {
      type: String,
      default: "",
    },
    postUrl: {
      type: String,
      required: true,
      trim: true,
    },
    hashtags: [
      {
        type: String,
        trim: true,
      },
    ],
    mentions: [
      {
        type: String,
        trim: true,
      },
    ],
    postedAt: {
      type: Date,
    },
    likes: {
      type: Number,
      default: null,
    },
    commentsCount: {
      type: Number,
      default: null,
    },
    scrapedAt: {
      type: Date,
      default: Date.now,
    },
    isAnalyzed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Post =
  (mongoose.models.Post as mongoose.Model<PostAttrs> | undefined) ||
  mongoose.model<PostAttrs>("Post", postSchema);
