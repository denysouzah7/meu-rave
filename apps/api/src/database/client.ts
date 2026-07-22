import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

const databasePath = resolve(process.cwd(), env.DATABASE_PATH);
mkdirSync(dirname(databasePath), { recursive: true });
mkdirSync(resolve(process.cwd(), env.UPLOAD_DIR), { recursive: true });

export const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });
