import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Extent from "@arcgis/core/geometry/Extent.js";
import type Polygon from "@arcgis/core/geometry/Polygon.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import * as labelPointOperator from "@arcgis/core/geometry/operators/labelPointOperator.js";
import Graphic from "@arcgis/core/Graphic.js";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol.js";
import TextSymbol from "@arcgis/core/symbols/TextSymbol.js";

import { config, isConfigured, LOWER_48_EXTENT } from "./config";
import { IntroDialog } from "./components/IntroDialog";
import { RegionDialog, type RegionAnswer } from "./components/RegionDialog";
import { RegionList } from "./components/RegionList";
import { loadGeometryOperators, polygonFromJson, prepareGeometry } from "./lib/geometry";
import { getSessionId, loadRegions, storeRegions, type SavedRegion } from "./lib/session";
import { submitRegion } from "./lib/submit";
import { useMediaQuery } from "./lib/useMediaQuery";

// Calcite dark-mode brand and warning colours
const BRAND = [0, 154, 242];
const DRAFT = [255, 201, 0];

const savedSymbol = new SimpleFillSymbol({
  color: [...BRAND, 0.22],
  outline: { color: [...BRAND, 1], width: 2 },
});

const draftSymbol = new SimpleFillSymbol({
  color: [...DRAFT, 0.18],
  outline: { color: [...DRAFT, 1], width: 2, style: "dash" },
});

function labelGraphic(polygon: Polygon, text: string) {
  return new Graphic({
    geometry: labelPointOperator.labelPointExecute(polygon),
    symbol: new TextSymbol({
      text,
      color: [255, 255, 255, 1],
      haloColor: [20, 20, 20, 0.9],
      haloSize: 1.5,
      font: { size: 11, weight: "bold", family: "Avenir Next" },
    }),
  });
}

interface Pending {
  graphic: Graphic;
  polygon: Polygon;
}

type Toast = { kind: "success" | "danger" | "warning"; title: string; message?: string } | null;

export default function App() {
  const mapRef = useRef<HTMLArcgisMapElement>(null);
  const sketchRef = useRef<HTMLArcgisSketchElement>(null);
  const lastSaveRef = useRef(0);

  const savedLayer = useMemo(
    () => new GraphicsLayer({ title: "Your regions", listMode: "hide" }),
    [],
  );
  const draftLayer = useMemo(
    () => new GraphicsLayer({ title: "Drawing", listMode: "hide" }),
    [],
  );

  const [introOpen, setIntroOpen] = useState(() => loadRegions().length === 0);
  const [regions, setRegions] = useState<SavedRegion[]>(loadRegions);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [mapError, setMapError] = useState(false);
  const [viewReady, setViewReady] = useState(false);
  const isMobile = useMediaQuery("(max-width: 720px)");

  const atLimit = regions.length >= config.limits.maxRegionsPerSession;

  // Draw saved regions from this tab's session (e.g. after a refresh)
  useEffect(() => {
    savedLayer.removeAll();
    for (const r of regions) {
      const polygon = polygonFromJson(r.geometry);
      savedLayer.addMany([
        new Graphic({ geometry: polygon, symbol: savedSymbol }),
        labelGraphic(polygon, r.name),
      ]);
    }
  }, [regions, savedLayer]);

  useEffect(() => {
    void loadGeometryOperators();
  }, []);

  const onViewReady = useCallback(() => {
    const view = mapRef.current?.view;
    if (!view) return;
    view.map?.addMany([savedLayer, draftLayer]);
    // The sketch makes its own layer if ours isn't on the map yet, so hand it
    // over now that it is
    const sketch = sketchRef.current;
    if (sketch && sketch.layer !== draftLayer) {
      const own = sketch.layer;
      sketch.layer = draftLayer;
      if (own) view.map?.remove(own);
    }
    // Basemap only: the web map's own popups have no place in the survey
    view.popupEnabled = false;
    view.constraints.minZoom = 2;
    view.constraints.rotationEnabled = false;
    view.padding = { ...view.padding, left: isMobile ? 0 : 340 };
    setViewReady(true);
    view.extent = new Extent({ ...LOWER_48_EXTENT, spatialReference: SpatialReference.WGS84 });
  }, [savedLayer, draftLayer, isMobile]);

  // Keep the floating panel from covering the map's centre on wider screens
  useEffect(() => {
    const view = mapRef.current?.view;
    if (view) view.padding = { ...view.padding, left: isMobile ? 0 : 340 };
  }, [isMobile, viewReady]);

  const startDrawing = useCallback(() => {
    if (atLimit) return;
    void sketchRef.current?.create("polygon", { mode: "hybrid" });
  }, [atLimit]);

  const clearDraft = useCallback(() => {
    draftLayer.removeAll();
    setPending(null);
    setSaveError(null);
  }, [draftLayer]);

  async function onCreate(e: CustomEvent<HTMLArcgisSketchElement["arcgisCreate"]["detail"]>) {
    if (e.detail.state !== "complete") return;
    const graphic = e.detail.graphic;
    if (!graphic?.geometry || graphic.geometry.type !== "polygon") return;

    if (atLimit) {
      draftLayer.remove(graphic);
      return;
    }

    const pixelSize = mapRef.current?.view?.resolution ?? 0;
    const check = await prepareGeometry(graphic.geometry as Polygon, pixelSize);
    if (!check.ok) {
      draftLayer.remove(graphic);
      setToast({ kind: "warning", title: "Let’s try that again", message: check.message });
      return;
    }
    graphic.geometry = check.polygon;
    graphic.symbol = draftSymbol;
    setSaveError(null);
    setPending({ graphic, polygon: check.polygon });
  }

  async function onSave(answer: RegionAnswer) {
    if (!pending || saving) return;

    const now = Date.now();
    const wait = config.limits.minSaveIntervalMs - (now - lastSaveRef.current);
    if (wait > 0) {
      setSaveError(`Please wait ${Math.ceil(wait / 1000)} more seconds before saving another region.`);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const index = regions.length + 1;
      // Bots fill the honeypot; act as if it worked but send nothing
      if (!answer.website && isConfigured) {
        await submitRegion({
          polygon: pending.polygon,
          name: answer.name,
          livesIn: answer.livesIn,
          sessionId: getSessionId(),
          index,
        });
      }
      lastSaveRef.current = Date.now();

      const region: SavedRegion = {
        localId: crypto.randomUUID(),
        index,
        name: answer.name,
        livesIn: answer.livesIn,
        geometry: pending.polygon.toJSON(),
        savedAt: Date.now(),
      };
      const next = [...regions, region];
      setRegions(next);
      storeRegions(next);
      clearDraft();
      setToast({ kind: "success", title: `Saved “${answer.name}”` });
    } catch (err) {
      console.error(err);
      setSaveError("Something went wrong on our end. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function onRedraw() {
    clearDraft();
    // Let the dialog close before the map takes the pointer
    window.setTimeout(startDrawing, 200);
  }

  function zoomTo(region: SavedRegion) {
    const view = mapRef.current?.view;
    const extent = polygonFromJson(region.geometry).extent;
    if (view && extent) void view.goTo(extent.clone().expand(1.4)).catch(() => {});
  }

  function goToLower48() {
    const view = mapRef.current?.view;
    if (view) {
      void view
        .goTo(new Extent({ ...LOWER_48_EXTENT, spatialReference: SpatialReference.WGS84 }))
        .catch(() => {});
    }
  }

  return (
    <calcite-shell contentBehind={!isMobile}>
      <calcite-navigation slot="header">
        <calcite-navigation-logo
          slot="logo"
          heading="Name Your Region"
          description={isMobile ? undefined : "Draw the regions of the US as you see them"}
          icon="polygon-vertices"
        />
        <calcite-action
          slot="content-end"
          icon="information"
          text="About this survey"
          onClick={() => setIntroOpen(true)}
        />
      </calcite-navigation>

      <calcite-shell-panel
        slot={isMobile ? "panel-bottom" : "panel-start"}
        layout={isMobile ? "horizontal" : "vertical"}
        displayMode={isMobile ? "dock" : "float-content"}
        widthScale="m"
        heightScale={isMobile ? "s" : "m"}
      >
        <calcite-panel heading="Your regions" description={`${regions.length} saved`}>
          <div className="panel-body">
            {!isConfigured && (
              <calcite-notice open kind="warning" icon="exclamation-mark-triangle" width="full" scale="s">
                <div slot="title">Test mode</div>
                <div slot="message">
                  No feature layer is set, so regions are kept in this tab only and nothing is sent.
                </div>
              </calcite-notice>
            )}

            {atLimit ? (
              <calcite-notice open kind="info" icon="check-circle" width="full" scale="s">
                <div slot="message">
                  That’s the most regions one visit can add. Thank you!
                </div>
              </calcite-notice>
            ) : (
              <>
                <calcite-button width="full" iconStart="polygon" onClick={startDrawing}>
                  {regions.length ? "Draw another region" : "Draw a region"}
                </calcite-button>
                {isMobile ? (
                  <p className="hint">
                    Tap to add points and double-tap to finish, or drag your finger to draw
                    freehand.
                  </p>
                ) : (
                  <p className="hint">
                    Click the map to add points and double-click to finish. Or press and drag to
                    draw freehand. Press <kbd>Esc</kbd> to cancel.
                  </p>
                )}
              </>
            )}

            <RegionList regions={regions} onZoom={zoomTo} />
          </div>
        </calcite-panel>
      </calcite-shell-panel>

      <arcgis-map
        ref={mapRef}
        itemId={config.webmapId || undefined}
        basemap={config.webmapId ? undefined : "dark-gray-vector"}
        popupDisabled
        onarcgisViewReadyChange={onViewReady}
        onarcgisLoadError={() => setMapError(true)}
      >
        <arcgis-zoom slot="top-right" />
        <calcite-action
          slot="top-right"
          className="map-action"
          icon="home"
          text="Show the lower 48"
          scale="s"
          onClick={goToLower48}
        />
        <arcgis-sketch
          ref={sketchRef}
          slot="top-right"
          layer={draftLayer}
          creationMode="single"
          availableCreateTools={["polygon"]}
          defaultCreateOptions={{ mode: "hybrid" }}
          polygonSymbol={draftSymbol}
          updateOnGraphicClickDisabled
          hideSelectionToolsLassoSelection
          hideSelectionToolsRectangleSelection
          hideSettingsMenu
          hideDeleteButton
          hideDuplicateButton
          hideLabelsToggle
          hideTooltipsToggle
          hideSnappingControls
          hideSelectionCountLabel
          layout="vertical"
          onarcgisCreate={(e) => void onCreate(e)}
        />
      </arcgis-map>

      <IntroDialog open={introOpen} onStart={() => setIntroOpen(false)} />

      <RegionDialog
        open={pending !== null}
        saving={saving}
        error={saveError}
        onSave={(a) => void onSave(a)}
        onRedraw={onRedraw}
        onDiscard={clearDraft}
      />

      <calcite-alert
        slot="alerts"
        open={toast !== null}
        kind={toast?.kind ?? "success"}
        icon
        autoClose
        autoCloseDuration="medium"
        label={toast?.title ?? "Notice"}
        oncalciteAlertClose={() => setToast(null)}
      >
        <div slot="title">{toast?.title}</div>
        {toast?.message && <div slot="message">{toast.message}</div>}
      </calcite-alert>

      <calcite-alert slot="alerts" open={mapError} kind="danger" icon label="Map error">
        <div slot="title">The map didn’t load</div>
        <div slot="message">Please refresh the page to try again.</div>
      </calcite-alert>
    </calcite-shell>
  );
}
