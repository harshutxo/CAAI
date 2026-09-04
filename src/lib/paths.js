import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..", "..");
export const dataDir = path.join(projectRoot, "data");
export const documentsDir = path.join(dataDir, "documents");
export const dbPath = process.env.CASUITE_DB_PATH ?? path.join(dataDir, "casuite.db");

fs.mkdirSync(documentsDir, { recursive: true });
