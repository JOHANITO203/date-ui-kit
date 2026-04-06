import { env } from "./config/env";
import { buildServer } from "./server";

async function start() {
  const server = buildServer();
  try {
    const address = await server.listen({ port: env.API_PORT, host: env.API_HOST });
    server.log.info(
      { address, appUrl: env.APP_URL },
      "Auth BFF listening for requests"
    );
  } catch (error) {
    server.log.error({ err: error }, "Auth BFF failed to start");
    process.exit(1);
  }
}

void start();
