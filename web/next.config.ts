import type { NextConfig } from "next";
import { execSync } from "child_process";

function buildLabel(): string {
  // Tenta git (funciona em dev local onde .git está acessível)
  try {
    const log = execSync("git log --oneline --merges -1", { encoding: "utf8" }).trim();
    const match = log.match(/#(\d+)/);
    if (match) return match[1]; // ex: "58"
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    if (sha) return sha;
  } catch { /* git não disponível no contexto Docker */ }

  // Fallback: data/hora do build em BRT (Docker build context não tem .git)
  return new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_LABEL: buildLabel(),
  },
};

export default nextConfig;
