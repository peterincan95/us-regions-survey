/// <reference types="vite/client" />
/// <reference types="@esri/calcite-components/types/react" />
/// <reference types="@arcgis/map-components/types/react" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_WEBMAP_ID?: string;
  readonly VITE_FEATURE_LAYER_URL?: string;
  readonly VITE_PORTAL_URL?: string;
}
