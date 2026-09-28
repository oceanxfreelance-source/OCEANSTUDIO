import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { STATE_FILE } from "./env";

export function e2eDb() {
  const { databaseUrl } = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { databaseUrl: string };
  return new PrismaClient({ datasourceUrl: databaseUrl });
}
