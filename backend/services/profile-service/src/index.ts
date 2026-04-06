import { buildServer } from "./server";
import { env } from "./config";

const start = async () => {
  const app = buildServer();
  await app.listen({ host: "0.0.0.0", port: env.PORT });
};

start().catch((error) => {
  console.error("profile-service failed to start", error);
  process.exit(1);
});
