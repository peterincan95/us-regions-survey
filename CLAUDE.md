# CLAUDE.md

Notes for Claude sessions in this repo. README.md covers what the app is, the
ArcGIS Online setup, and the security model. This file covers how to work on it.

## Running and checking changes

- Dev server: the `us-regions-survey` entry in `../.claude/launch.json` (port 5174).
  Production build: `us-regions-survey-build` (port 4174, runs `vite preview`;
  run `npm run build` first).
- No test suite. `npm run typecheck`, then check in the browser pane.
- Drawing in the browser pane: the sketch places each vertex where the pointer
  last *moved*, and synthetic clicks don't send moves. Hover over each point
  before clicking it, or every vertex lands in the same spot.
- Vite sometimes serves a stale module after several quick edits (e.g. a
  "not defined" error for code that is plainly there). Restart the dev server.
- Check the production build after touching CSS, the CSP, or anything that loads
  WebAssembly. Two bugs have only shown up there: the CSP blocking the projection
  engine's WASM (needs `'wasm-unsafe-eval'`), and the CSS minifier breaking
  Calcite's `light-dark()` tokens (fixed with `build.cssTarget`).

## How the app works

- ArcGIS Maps SDK 5.2 (`@arcgis/core` + `@arcgis/map-components`, pinned to the
  same version) and Calcite 5.2, from npm. React 19 uses the web components
  directly; events are `on<eventName>` (e.g. `onarcgisCreate`, `oncalciteDialogClose`).
- `App.tsx` owns the map, the two graphics layers ("Your regions", "Drawing") and
  the flow: draw, then `prepareGeometry` checks, then `RegionDialog`, then
  `submitRegion`, then the session list.
- The `arcgis-sketch` creates its own layer if its `layer` isn't on the map yet;
  `onViewReady` hands it the Drawing layer after adding the layers.
- Saved regions can't be edited or deleted. The public view is add-only, so the
  app has no way to change them.
- Settings live in `src/config.ts`; IDs and URLs come from `.env`.

## Conventions

- Use Calcite components wherever possible.
- All user-facing text lives in the `COPY` object at the top of `src/App.tsx`
  (plus the `<title>` and description `<meta>` in `index.html`). Components and
  `lib/` return codes or take `copy` props instead of holding their own strings.
  Don't write or change the wording; the user writes all copy. New text goes in
  as a Lorem ipsum placeholder.
- Never put secrets in `.env` or the source; everything here ships to browsers.
- Never point `VITE_FEATURE_LAYER_URL` at the private source layer.

## Git

- Same flow as canada-language-map: `dev` is the default branch; `main` is
  production and deploys to GitHub Pages on every push. Branch from `dev`; never
  commit straight to `main`.
- Commit, push and open PRs only when the user asks.
