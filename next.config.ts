import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pins the workspace root to this project so Turbopack stops looking for
    // a lockfile in parent directories outside the git repo.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
