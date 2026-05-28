import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"]
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.{ts,tsx}"],
    environmentMatchGlobs: [
      ["src/**/auth-form.spec.tsx", "jsdom"],
      ["src/**/use-current-location.spec.ts", "jsdom"],
      ["src/**/location-search.spec.tsx", "jsdom"],
      ["src/**/map-view.spec.tsx", "jsdom"]
    ]
  }
});
