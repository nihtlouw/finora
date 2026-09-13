import "dotenv/config";
import { defineConfig } from "prisma/config";
import { normalizePostgresConnectionUrl } from "./lib/db/postgres-url";

const directUrl = process.env.DIRECT_URL;
if (!directUrl) throw new Error("DIRECT_URL is not configured.");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: normalizePostgresConnectionUrl(directUrl) },
});
