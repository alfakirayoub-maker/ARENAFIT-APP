# Arena Fit brand assets

Drop the **official** Arena Fit logo files here. Never redraw, regenerate or
re-proportion the logo.

Expected files:

| File | Use |
| --- | --- |
| `arenafit-logo.png` (or `.svg` exported to PNG @3x) | In-app logo, light version for dark backgrounds |
| `app-icon-1024.png` | App icon (square, no transparency) |
| `splash.png` | Splash screen mark |

Then:

1. Point `src/components/brand/logo-source.ts` at the logo with its real aspect ratio.
2. Point `icon` / `splash` in `app.json` at the new files.
3. Sample the exact lime green from the official file and update
   `colors.primary` in `src/theme/tokens.ts`.
