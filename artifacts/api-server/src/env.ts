import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dns from "node:dns";

// The hosting sandbox advertises IPv6 but routes it poorly; Node tries IPv6
// first and burns seconds per outbound request (enough to trip the profanity
// filter's fail-open timeout). Prefer IPv4 for all outbound calls.
dns.setDefaultResultOrder("ipv4first");

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
