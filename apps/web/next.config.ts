import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@teamcomposer/db", "@teamcomposer/optimizer"],
  serverExternalPackages: ["redis"],
  /**
   * Workspace `@teamcomposer/db` resolves from `packages/db`; Turbopack otherwise
   * looks for deps next to that folder. Relative aliases are resolved from `apps/web`.
   */
  turbopack: {
    resolveAlias: {
      "drizzle-orm": "./node_modules/drizzle-orm",
      "drizzle-orm/node-postgres": "./node_modules/drizzle-orm/node-postgres",
      "drizzle-orm/pg-core": "./node_modules/drizzle-orm/pg-core",
      pg: "./node_modules/pg",
      redis: "./node_modules/redis",
    },
  },
};

export default nextConfig;
