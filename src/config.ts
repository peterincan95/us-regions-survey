// App settings. IDs and URLs come from .env (public values, not secrets).

export const config = {
  webmapId: import.meta.env.VITE_WEBMAP_ID?.trim() ?? "",
  // A service URL without a layer index means its first layer
  featureLayerUrl: (import.meta.env.VITE_FEATURE_LAYER_URL?.trim() ?? "")
    .replace(/\/+$/, "")
    .replace(/\/FeatureServer$/i, "/FeatureServer/0"),
  portalUrl: import.meta.env.VITE_PORTAL_URL?.trim() ?? "",
  appVersion: __APP_VERSION__,

  // Field names in the hosted feature layer
  fields: {
    regionName: "region_name",
    livesIn: "lives_in",
    sessionId: "session_id",
    polyIndex: "poly_index",
    appVersion: "app_version",
  },

  limits: {
    nameMaxLength: 80,
    // Per browser tab. Stops runaway submissions; real people rarely draw more than a handful.
    maxRegionsPerSession: 25,
    // Minimum time between saves, in milliseconds
    minSaveIntervalMs: 3000,
    // After generalizing; freehand shapes are simplified down well below this
    maxVertices: 1000,
    minAreaKm2: 10,
    maxAreaKm2: 20_000_000,
  },
} as const;

/** Lower 48 view on load (WGS84). Users can pan to Alaska and Hawaii. */
export const LOWER_48_EXTENT = {
  xmin: -125.5,
  ymin: 23.5,
  xmax: -66,
  ymax: 50,
};

/**
 * Rough boxes around the US (WGS84). A region must touch at least one of these.
 * Alaska's box stops at the antimeridian; the far western Aleutians are left out.
 */
export const US_BOXES = [
  { name: "Lower 48", xmin: -125.5, ymin: 24, xmax: -66.5, ymax: 49.5 },
  { name: "Alaska", xmin: -180, ymin: 51, xmax: -129.5, ymax: 71.6 },
  { name: "Hawaii", xmin: -160.8, ymin: 18.8, xmax: -154.6, ymax: 22.4 },
];

export const isConfigured = Boolean(config.featureLayerUrl);
