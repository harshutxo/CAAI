#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  process.loadEnvFile(path.join(projectRoot, ".env"));
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}

import("../src/cli.js");
