import mongoose from "mongoose";

export async function connectToDatabase() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  mongoose.connection.on("connected", () => {
    console.log("Mongoose connected to MongoDB successfully");
  });

  mongoose.connection.on("error", (err) => {
    console.error(`Mongoose connection error occurred: ${err instanceof Error ? err.message : String(err)}`);
  });

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log("Connected to MongoDB");
}
