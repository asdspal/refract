import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["snarkjs", "circomlibjs"],
};

export default nextConfig;
