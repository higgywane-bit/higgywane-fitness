import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Leah reads the owner's guide from disk at runtime
  outputFileTracingIncludes: { "/api/leah": ["./content/leah/guide.md"] },
};

export default nextConfig;
