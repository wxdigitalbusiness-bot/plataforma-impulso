import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone — reduz drasticamente o tamanho da imagem Docker.
  // Empacota só os deps que o runtime usa, dispensando node_modules completo.
  output: "standalone",
};

export default nextConfig;
