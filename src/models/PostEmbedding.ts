import mongoose, { Schema } from "mongoose";

export interface PostEmbeddingAttrs {
  postId: string;
  username: string;
  embedding: number[];
  model: string;
  createdAt: Date;
}

const postEmbeddingSchema = new Schema(
  {
    postId: {
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
    embedding: {
      type: [Number],
      required: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const PostEmbedding =
  (mongoose.models.PostEmbedding as mongoose.Model<PostEmbeddingAttrs> | undefined) ||
  mongoose.model<PostEmbeddingAttrs>("PostEmbedding", postEmbeddingSchema);
