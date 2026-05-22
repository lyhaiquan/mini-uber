# Asset placeholders

This folder needs three PNG files referenced by `app.json`:

- `icon.png` — 1024×1024 (main app icon).
- `splash.png` — 1242×2436 recommended (loading splash).
- `adaptive-icon.png` — 1024×1024 (Android adaptive icon foreground).

For thesis demo, generate placeholders with any tool (eg `expo prebuild --clean` produces defaults). Until then, Expo will warn but still run.

Production icons should match the brand from `@ridex/ui-tokens` (`#0a84ff` primary). Defer real assets to T024 (deploy).
