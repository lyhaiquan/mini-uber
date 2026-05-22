# @ridex/ui-mobile

NativeWind-styled React Native primitives for `apps/mobile-customer` and `apps/mobile-driver`.

## Components

- `Button` (variants: default/secondary/outline/ghost/destructive; sizes sm/md/lg; loading state)
- `Card` — bordered container with shadow
- `Input` — TextInput with shared styling
- `Text` (variants: h1/h2/body/caption)
- `Screen` — SafeAreaView wrapper with optional scroll

## Consuming

NativeWind must be configured in the consumer app (`tailwind.config.ts` + `babel.config.js`). Each app's tailwind config must include `../../packages/ui-mobile/src/**/*.{ts,tsx}` in `content`.

```tsx
import { Button, Card, Text } from "@ridex/ui-mobile";

<Card>
  <Text variant="h2">Welcome</Text>
  <Button onPress={() => navigate("/login")}>Continue</Button>
</Card>
```

Peer deps: `react`, `react-native`, `nativewind@^4`, `react-native-safe-area-context`. Consumer is responsible for installing them.
