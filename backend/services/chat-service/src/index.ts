import { buildServer } from "./server";
import { env } from "./config";

const start = async () => {
  const app = buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
};

start().catch((error) => {
  console.error("chat-service failed to start", error);
  process.exit(1);
});
