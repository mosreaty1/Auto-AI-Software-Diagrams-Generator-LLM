#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const changedFile = process.argv[2];

if (!changedFile) {
  console.error("Usage: node ./src/hook-entry.js <changed-file>");
  process.exit(1);
}

const cliPath = path.resolve(process.cwd(), "src", "cli.js");
const result = spawnSync(process.execPath, [cliPath, "--file", changedFile], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
