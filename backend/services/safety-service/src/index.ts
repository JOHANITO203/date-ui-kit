import { buildServer } from "./server.js";
import { env } from "./config.js";

const start = async () => {
  const app = buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
};

start().catch((error) => {
  console.error("safety-service failed to start", error);
  process.exit(1);
});

