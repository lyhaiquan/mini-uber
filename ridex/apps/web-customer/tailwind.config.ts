import { tailwindPreset } from "@ridex/ui-tokens";
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui-web/src/**/*.{ts,tsx}"
  ],
  presets: [tailwindPreset as Partial<Config>],
  theme: {},
  plugins: []
};

export default config;
