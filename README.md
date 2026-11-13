# Name Your Region

A public survey app. People draw polygons around parts of the US they think of as a
region, name each one, and say whether they live there. Answers go to an ArcGIS
Online hosted feature layer. Respondents need no account, and each person only ever
sees their own shapes.

Built with React, the ArcGIS Maps SDK for JavaScript (map components) and Calcite.

## How it works

- Each polygon is sent as soon as it's named and saved. Saved regions can't be
  edited or removed, and the app says so before saving.
- The app writes to a **public, add-only feature layer view**. That view can't
  return any features, so other people's answers never reach the browser.
- The polygons from this visit are drawn from the browser tab's own memory
  (`sessionStorage`), which also holds a random session ID. Closing the tab clears
  both.

## ArcGIS Online setup

1. **Create the hosted feature layer** (polygons) with these fields:

   | Field | Type | Notes |
   |---|---|---|
   | `region_name` | String, length 80 | |
   | `lives_in` | Small integer | Add a coded-value domain: 0 = No, 1 = Yes |
   | `session_id` | String, length 36 | Random per browser tab; groups one visit's polygons |
   | `poly_index` | Small integer | 1, 2, 3… within the session |
   | `app_version` | String, length 20 | |
| `comments` | String, length 500 | Optional. The app only sends it if the field exists |

   In the layer's settings, turn on **editor tracking** to record creation dates.
   **Don't share this layer.** It stays private and holds the real data.

2. **Create a view layer** from it (on the item page: *Create View Layer*). On the view:
   - **Share it with Everyone (public).**
   - In *Settings → Editing*, turn on **Enable editing** and allow **Add** only (no
     update or delete).
   - Set *What features can editors see?* to **Editors can't see any features, even
     those they add**.
   - Turn off **Enable Sync** and **Allow others to export**.
   - Optional: in *Visualization*, or by setting a view definition, hide every field
     except the six above.

3. **Web map:** a public web map from your org with only a basemap (dark gray
   canvas suits the app's dark theme). The app hides popups and adds its own layers.

4. **Copy the IDs into [`.env`](.env):**

   ```
   VITE_WEBMAP_ID=<web map item ID>
   VITE_FEATURE_LAYER_URL=https://services.arcgis.com/<org>/arcgis/rest/services/<view>/FeatureServer/0
   ```

   These values are public; both end up in the browser anyway. Use the **view's**
   URL, never the source layer's. For local overrides, use `.env.local` (git-ignored).

Until `VITE_FEATURE_LAYER_URL` is set, the app runs in **test mode**: regions stay
in the tab and nothing is sent. A banner says so.

## Security and privacy

- No sign-in and no personal data: no IP address, no location, no cookies. The
  session ID is random and lasts only as long as the browser tab.
- Region names are cleaned (control characters removed, whitespace collapsed,
  length capped at 80) and only ever shown as text, never as HTML.
- Before saving, each polygon is simplified and generalized. It must not cross over
  itself, must be larger than 10 km², and can have at most 1,000 vertices after
  generalizing. There's no limit on location or maximum size, so check for shapes
  outside the US or covering huge areas during analysis.
- Limits per tab: 25 regions, and at least 3 seconds between saves. Bots that fill
  the hidden honeypot field get a fake success, and nothing is sent.
- A Content-Security-Policy is added to the production build (see
  [`vite.config.ts`](vite.config.ts)). GitHub Pages can't send headers, so it goes
  in a `<meta>` tag. If the web map uses a non-Esri tile host, add that host there.

**Known limit:** these checks run in the browser. Anyone who finds the view's URL can
still post features straight to it, and AGOL doesn't rate-limit anonymous edits.
Check incoming data for junk before analysing it, for example by grouping on
`session_id` and looking for bursts. If abuse becomes a real problem, the fix is a
small server-side relay with a CAPTCHA and rate limiting. That would also let the
layer stop being public.

## Development

```bash
npm install
npm run dev        # Vite dev server
npm run build      # type-checks, then builds to dist/
npm run preview    # serves dist/ with the production CSP
```

Run the production build at least once before releasing. The CSP and CSS
minification only apply there.

## Deploying

Every push to `main` builds the app and publishes it to GitHub Pages
([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)). In the
repo's *Settings → Pages*, set *Source* to **GitHub Actions**.
