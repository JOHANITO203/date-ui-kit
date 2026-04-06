import { env } from "./config";
import { buildServer } from "./server";

async function start() {
  const server = buildServer();
  try {
    const address = await server.listen({ port: env.API_PORT, host: env.API_HOST });
    server.log.info({ address }, "discover-service listening");
  } catch (error) {
    server.log.error({ err: error }, "discover-service failed to start");
    process.exit(1);
  }
}

void start();
