import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

// GitHub Pages can't send response headers, so the security policy goes in a
// <meta> tag. It's added only to the production build: the dev server relies
// on inline scripts for hot reload.
//
// ArcGIS needs its CDN (js.arcgis.com) for assets, arcgis.com for the web map,
// basemap tiles and the feature service, and blob: workers. If the web map is on
// another portal or uses non-Esri tiles, add that host here.
const CSP = [
  "default-src 'self'",
  // wasm-unsafe-eval lets the projection engine compile WebAssembly; it does not allow eval()
  "script-src 'self' 'wasm-unsafe-eval' https://js.arcgis.com blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://js.arcgis.com",
  "img-src 'self' data: blob: https://*.arcgis.com https://*.arcgisonline.com",
  "font-src 'self' data: https://js.arcgis.com https://*.arcgis.com",
  "connect-src 'self' https://*.arcgis.com https://*.arcgisonline.com https://js.arcgis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
        injectTo: "head-prepend",
      },
    ],
  };
}

// Relative base so the build works at https://<user>.github.io/<repo>/
export default defineConfig({
  base: "./",
  plugins: [react(), contentSecurityPolicy()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Calcite's colour tokens use CSS light-dark(). Older targets make the minifier
    // rewrite it into variables that break dark mode, so target browsers that
    // support it natively (all current evergreen browsers do).
    cssTarget: ["chrome123", "edge123", "firefox120", "safari17.5"],
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
});
