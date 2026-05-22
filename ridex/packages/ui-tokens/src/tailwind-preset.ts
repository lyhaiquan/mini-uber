import { colors } from "./colors";
import { borderRadius } from "./radius";
import { spacing } from "./spacing";
import { fontFamily, fontSize, fontWeight } from "./typography";

export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        surface: colors.surface,
        text: colors.text,
        state: colors.state,
        brand: colors.brand
      },
      spacing,
      borderRadius,
      fontFamily,
      fontSize,
      fontWeight
    }
  }
};
