#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const OPENCLAW_MJS_ENV = process.env.OPENCLAW_MJS_PATH?.trim();
const OPENCLAW_GLOBAL_ROOT_ENV = process.env.OPENCLAW_GLOBAL_ROOT?.trim();
const OPENCLAW_NODE_PATH_ENV = process.env.OPENCLAW_NODE_PATH?.trim();

const semverToTuple = (value) => {
  const clean = value.replace(/^v/, "").trim();
  const parts = clean.split(".").map((p) => Number(p));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
};

const isNodeCompatible = (versionString) => {
  const [maj, min] = semverToTuple(versionString);
  return maj > 22 || (maj === 22 && min >= 12);
};

const findNodeFromNvm = () => {
  const nvmRoot = path.join(os.homedir(), "AppData", "Local", "nvm");
  if (!existsSync(nvmRoot)) return null;

  const versions = readdirSync(nvmRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v?\d+\.\d+\.\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const [amaj, amin, apat] = semverToTuple(a);
      const [bmaj, bmin, bpat] = semverToTuple(b);
      if (amaj !== bmaj) return bmaj - amaj;
      if (amin !== bmin) return bmin - amin;
      return bpat - apat;
    });

  for (const v of versions) {
    const nodeExe = path.join(nvmRoot, v, "node.exe");
    if (existsSync(nodeExe) && isNodeCompatible(v)) return nodeExe;
  }
  return null;
};

const resolveNodeExecutable = () => {
  if (OPENCLAW_NODE_PATH_ENV && existsSync(OPENCLAW_NODE_PATH_ENV)) {
    return OPENCLAW_NODE_PATH_ENV;
  }
  if (isNodeCompatible(process.version)) {
    return process.execPath;
  }
  return findNodeFromNvm();
};

const resolveOpenclawMjs = () => {
  if (OPENCLAW_MJS_ENV && existsSync(OPENCLAW_MJS_ENV)) return OPENCLAW_MJS_ENV;

  const globalRootCandidates = [];
  if (OPENCLAW_GLOBAL_ROOT_ENV) globalRootCandidates.push(OPENCLAW_GLOBAL_ROOT_ENV);
  globalRootCandidates.push(path.join("D:", ".npm-global", "node_modules"));
  globalRootCandidates.push(path.join(process.env.APPDATA || "", "npm", "node_modules"));

  for (const root of globalRootCandidates) {
    if (!root) continue;
    const candidate = path.join(root, "openclaw", "openclaw.mjs");
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

const nodeExe = resolveNodeExecutable();
if (!nodeExe) {
  console.error(
    "[openclaw-runner] Node >= 22.12 introuvable. Definis OPENCLAW_NODE_PATH ou installe Node 24 via nvm.",
  );
  process.exit(1);
}

const openclawMjs = resolveOpenclawMjs();
if (!openclawMjs) {
  console.error(
    "[openclaw-runner] openclaw.mjs introuvable. Definis OPENCLAW_MJS_PATH ou OPENCLAW_GLOBAL_ROOT.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const child = spawn(nodeExe, [openclawMjs, ...args], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
