import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // PGlite ships a WASM Postgres; load it from node_modules instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
  // SQL migrations are read at runtime by the local/preview database.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  // Glofox / Qashier CSV exports are posted to server actions.
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
};

export default nextConfig;
