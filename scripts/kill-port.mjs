#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";

const arg = process.argv[2];
const port = Number(arg || 4000);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`[kill-port] Invalid port: ${arg}`);
  process.exit(1);
}

function killPid(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(pid), "/F"], { stdio: "pipe", encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "").trim() || `Failed to kill PID ${pid}`);
    }
    return;
  }

  const result = spawnSync("kill", ["-9", String(pid)], { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "").trim() || `Failed to kill PID ${pid}`);
  }
}

function pidsOnPortWindows(targetPort) {
  const output = execSync("netstat -ano -p tcp", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const lines = output.split(/\r?\n/);
  const found = new Set();

  for (const line of lines) {
    if (!line.includes("LISTENING")) continue;
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5) continue;
    const local = cols[1] || "";
    const state = cols[3] || "";
    const pid = cols[4] || "";
    if (state !== "LISTENING") continue;
    const m = local.match(/:(\d+)$/);
    if (!m) continue;
    if (Number(m[1]) === targetPort && /^\d+$/.test(pid)) {
      found.add(pid);
    }
  }

  return [...found];
}

function pidsOnPortUnix(targetPort) {
  const output = execSync(`lsof -ti :${targetPort}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x));
}

try {
  const pids = process.platform === "win32" ? pidsOnPortWindows(port) : pidsOnPortUnix(port);
  if (pids.length === 0) {
    process.exit(0);
  }

  for (const pid of pids) {
    try {
      killPid(pid);
      console.log(`[kill-port] Freed port ${port} by killing PID ${pid}`);
    } catch (err) {
      console.error(`[kill-port] Could not kill PID ${pid} on port ${port}: ${err.message}`);
      process.exitCode = 1;
    }
  }
} catch (err) {
  const message = String(err?.message || err);
  const isNoProcessCase =
    message.includes("No such file or directory") ||
    message.toLowerCase().includes("no process") ||
    message.toLowerCase().includes("cannot find");

  if (isNoProcessCase) {
    process.exit(0);
  }

  console.error(`[kill-port] Error while checking port ${port}: ${message}`);
  process.exit(1);
}
