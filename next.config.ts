import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
