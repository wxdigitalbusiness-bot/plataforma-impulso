import type { NextConfig } from "next";
import { execSync } from "child_process";

function gitInfo(): { sha: string; pr: string } {
  try {
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    // Extrai número do último merge PR: "Merge pull request #53 from ..."
    const log = execSync("git log --oneline --merges -1", { encoding: "utf8" }).trim();
    const match = log.match(/#(\d+)/);
    const pr = match ? `#${match[1]}` : sha;
    return { sha, pr };
  } catch {
    return { sha: "dev", pr: "" };
  }
}

const { sha, pr } = gitInfo();

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_SHA: sha,
    NEXT_PUBLIC_BUILD_PR:  pr,
  },
};

export default nextConfig;
