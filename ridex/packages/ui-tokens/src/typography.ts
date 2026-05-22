export const fontFamily = {
  sans: [
    "Inter",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif"
  ],
  mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
} as const;

export const fontSize = {
  xs: ["12px", { lineHeight: "16px" }],
  sm: ["14px", { lineHeight: "20px" }],
  base: ["16px", { lineHeight: "24px" }],
  lg: ["18px", { lineHeight: "28px" }],
  xl: ["20px", { lineHeight: "28px" }],
  "2xl": ["24px", { lineHeight: "32px" }],
  "3xl": ["30px", { lineHeight: "36px" }],
  "4xl": ["36px", { lineHeight: "40px" }]
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700"
} as const;

export type TypographyTokens = {
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
};
