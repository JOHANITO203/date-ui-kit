import { PrismaClient } from "@prisma/client";
let _client: PrismaClient | null = null;
export const getPrismaClient = (): PrismaClient => {
  if (!_client) {
    _client = new PrismaClient({ log: process.env.NODE_ENV !== "production" ? ["warn", "error"] : ["error"] });
  }
  return _client;
};
export const prismaClient = getPrismaClient();
