# 🎲 Foodie Fortune

A mobile-first cuisine randomizer PWA. Spin a wheel to decide tonight's takeaway or dine-in — with per-player vetoes, a customizable menu, and one-tap deep links into Google Maps and Uber Eats. Runs **100% client-side**, no backend, free to host.

## Features
- 🎡 High-DPI canvas wheel with 60fps deceleration physics + haptic ticks
- 🛋️ / 🍽️ Takeaway vs Dine-In mode (switches deep-link targets)
- 👥 Party setup (1–6 players) with per-player veto tokens
- 🙅 Veto a result → removes it from the wheel and re-spins
- ⚙️ Enable/disable cuisines, add custom ones, restore defaults
- 🔒 Final lock-in with confetti when vetoes run out
- 📱 Installable PWA (Add to Home Screen), portrait, standalone
- 🕵️ Privacy-first: no hardcoded names/locations; all personalization lives in `localStorage`

## Run locally
It's a static bundle — just serve the folder:

```powershell
# from the project root (Windows: use py.exe)
py.exe -m http.server 8080 --bind 127.0.0.1
```

Then open http://127.0.0.1:8080. (Opening `index.html` via `file://` mostly works, but the manifest/PWA bits need a server.)

## Deploy to GitHub Pages
1. Create a public repo and push these files to the default branch.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick your branch, folder `/ (root)`.
3. Visit `https://<username>.github.io/<repo-name>/`.

All asset paths are **relative** (`./styles.css`, `./app.js`, `./manifest.json`, `./icon.svg`) so it works from a repo subpath. `.nojekyll` is included so Pages serves files as-is.

## Files
| File | Purpose |
| --- | --- |
| `index.html` | Markup + meta tags |
| `styles.css` | Theme + layout |
| `app.js` | Wheel physics, state, veto engine, deep links |
| `manifest.json` | PWA manifest (inline SVG icon) |
| `icon.svg` | App icon |
| `.nojekyll` | Tell Pages to skip Jekyll |
| `BRIEF.md` | Original product spec |

## Notes
- `canvas-confetti` loads from a CDN for the win celebration; if the CDN is blocked the app still works (confetti is wrapped in a guard).
- Haptics use `navigator.vibrate()` (Android); gracefully ignored on iOS.
