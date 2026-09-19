import dotenv from "dotenv";

dotenv.config();

import { connectDB } from "./config/db";
import { createApp } from "./app";

const app = createApp();
const PORT = process.env.PORT || 5000;

async function main(): Promise<void> {
  await connectDB();

  // No callback is passed to app.listen(): Express binds a listen callback
  // to both the "listening" and "error" events, so it fires on bind failure
  // too. Attaching our own listeners below avoids that false-success trap.
  const server = app.listen(PORT);

  server.on("listening", () => {
    console.log(`Server listening on port ${PORT}`);
  });

  server.on("error", (err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
