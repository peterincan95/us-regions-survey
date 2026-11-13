import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import esriConfig from "@arcgis/core/config.js";

import "@esri/calcite-components/main.css";
import "@arcgis/core/assets/esri/themes/dark/main.css";
import "./styles.css";

import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-sketch";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-home";

import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-navigation";
import "@esri/calcite-components/components/calcite-navigation-logo";
import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-dialog";
import "@esri/calcite-components/components/calcite-input-text";
import "@esri/calcite-components/components/calcite-text-area";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-checkbox";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-alert";
import "@esri/calcite-components/components/calcite-icon";
import "@esri/calcite-components/components/calcite-chip";

import { config } from "./config";
import App from "./App";

if (config.portalUrl) esriConfig.portalUrl = config.portalUrl;
// Anonymous use only: never prompt for an ArcGIS sign-in
esriConfig.request.useIdentity = false;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
