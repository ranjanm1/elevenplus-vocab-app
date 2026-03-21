import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: [
    "192.168.68.111",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;