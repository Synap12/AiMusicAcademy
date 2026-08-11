import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env from the workspace root or the package dir (dev runs with
// cwd=artifacts/api-server, deployments with cwd=repo root). Values
// already present in the environment win over the file.
for (const candidate of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
]) {
  if (!existsSync(candidate)) continue;
  for (const line of readFileSync(candidate, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
  break;
}
