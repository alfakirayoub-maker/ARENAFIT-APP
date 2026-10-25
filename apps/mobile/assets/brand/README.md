# Arena Fit brand assets

Drop the **official** Arena Fit logo files here. Never redraw, regenerate or
re-proportion the logo.

Expected files:

| File | Use |
| --- | --- |
| `arena-fit-logo.png` | In-app logo, exactly as supplied (PNG, ideally @3x) |
| `app-icon-1024.png` | App icon (square, no transparency) |
| `splash.png` | Splash screen mark |

Then:

1. Point `src/components/brand/logo-source.ts` at `arena-fit-logo.png` with its real pixel aspect ratio (rendered with `contentFit="contain"`, never recolored or redrawn).
2. Point `icon` / `splash` in `app.json` at the new files.
3. The logo green (#80B918) is already the `brand` token in `src/theme/tokens.ts`.
