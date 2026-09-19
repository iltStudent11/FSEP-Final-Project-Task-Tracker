import mongoose from "mongoose";

const TEST_MONGODB_URI =
  process.env.MONGODB_URI_TEST ?? "mongodb://127.0.0.1:27017/policy-claims-test";

export async function connectTestDB(): Promise<void> {
  await mongoose.connect(TEST_MONGODB_URI);
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDB(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
