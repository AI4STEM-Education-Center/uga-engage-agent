import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

export const getDb = () => {
  if (db) {
    return db;
  }

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "engage.sqlite");
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS strategy_cache (
      student_id TEXT PRIMARY KEY,
      plan_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return db;
};
