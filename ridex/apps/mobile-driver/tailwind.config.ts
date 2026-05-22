import { tailwindPreset } from "@ridex/ui-tokens";
import type { Config } from "tailwindcss";

// nativewind/preset is CommonJS only; require is intentional here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativewindPreset = require("nativewind/preset");

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui-mobile/src/**/*.{ts,tsx}"
  ],
  presets: [nativewindPreset, tailwindPreset as unknown as Partial<Config>],
  theme: {},
  plugins: []
};

export default config;
