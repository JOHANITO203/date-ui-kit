import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

let _client: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!_client) {
    _client = new PrismaClient({
      datasources: { db: { url: env.DATABASE_URL } },
    });
  }
  return _client;
};

export const prismaClient = getPrismaClient();
