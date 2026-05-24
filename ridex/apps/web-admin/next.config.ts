import path from "node:path";

import type { NextConfig } from "next";

const workspaceNodeModules = path.resolve(process.cwd(), "..", "..", "node_modules");

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ridex/ui-tokens", "@ridex/shared-types"],
  typedRoutes: false,
  webpack: (webpackConfig) => {
    webpackConfig.resolve ??= {};
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias ?? {}),
      "react$": path.join(workspaceNodeModules, "react", "index.js"),
      "react-dom$": path.join(workspaceNodeModules, "react-dom", "index.js"),
      "react/jsx-runtime": path.join(workspaceNodeModules, "react", "jsx-runtime.js"),
      "react/jsx-dev-runtime": path.join(workspaceNodeModules, "react", "jsx-dev-runtime.js")
    };

    return webpackConfig;
  }
};

export default config;
