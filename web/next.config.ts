import type { NextConfig } from "next";
import { execSync } from "child_process";

function buildLabel(): string {
  // Build arg injetado pelo Dockerfile (BUILD_LABEL=<número do PR>)
  if (process.env.BUILD_LABEL) return process.env.BUILD_LABEL;

  // Fallback local: extrai número do último merge no git
  try {
    const log = execSync("git log --oneline --merges -1", { encoding: "utf8" }).trim();
    const match = log.match(/#(\d+)/);
    if (match) return match[1];
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    if (sha) return sha;
  } catch { /* git não disponível */ }

  return "dev";
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_LABEL: buildLabel(),
  },
};

export default nextConfig;
