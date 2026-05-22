// NativeWind transforms `className` into `style` at runtime via Babel. In jest
// we stub it out — the className prop just becomes a plain attribute on the
// mocked host element, which is enough for component-level assertions.
export const styled = <T,>(component: T): T => component;
export const cssInterop = () => undefined;
export const useColorScheme = () => ({ colorScheme: "light" as const, setColorScheme: () => undefined });
