# @ridex/ui-web

shadcn-style React components for `apps/web-*`. Hand-written to avoid pulling shadcn CLI into the workspace; you can still run `npx shadcn@latest add <component>` in any web app and adapt the output here when you need more primitives.

## Components

- `Button` (variants: default/secondary/outline/ghost/destructive/link; sizes sm/md/lg/icon)
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Input`, `Label`
- `Spinner` (lucide `Loader2`)

## Consuming

```tsx
import { Button, Card, Input } from "@ridex/ui-web";

<Card>
  <Input placeholder="Email" />
  <Button>Continue</Button>
</Card>
```

Tailwind `content` array in the consumer app MUST include `../../packages/ui-web/src/**/*.{ts,tsx}` so unused classes aren't tree-shaken.
