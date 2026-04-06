import { buildServer } from "./server.js";
import { env } from "./config.js";

const start = async () => {
  const server = buildServer();
  await server.listen({ host: "0.0.0.0", port: env.PORT });
};

start().catch((error) => {
  console.error("payments-service failed to start", error);
  process.exit(1);
});

