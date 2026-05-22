import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ridex/ui-web", "@ridex/ui-tokens", "@ridex/shared-types"],
  typedRoutes: false
};

export default config;
