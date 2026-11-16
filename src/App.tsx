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

// ─── App copy ───────────────────────────────────────────────────────────────
// Every piece of text people see in the app.
// Functions are for text that includes a value (a count, a name, seconds).
// The only text outside this block is the <title> and description <meta> in
// index.html, which link previews read before the app loads.
export const COPY = {
  /** Browser tab title once the app has loaded */
  pageTitle: "Where is Here?",

  header: {
    heading: "Region Namer",
    description: "Draw the regions of the US as you see them",
    /** Tooltip and screen-reader label for the (i) button that reopens the intro */
    aboutButton: "About this survey",
  },

  intro: {
    heading: "How do you see the United States?",
    body:
      "Draw and name the shapes you think best define the United States. Draw as many or as few regions as you want. Make them as big or small as you want. They can be well known (the Midwest, the South), or more specific.",
    privacyTitle: "Your privacy",
    /** One bullet each */
    privacyPoints: [
      "The app saves your shapes, their names, any comments, and a random code that groups the shapes from this visit. No additional location or user data is collected",
      "You’ll only ever see your own shapes. Answers may be published as combined maps.",
    ],
    startButton: "Start",
  },

  panel: {
    heading: "Your map of the US",
    /** Under the heading, e.g. "3 saved" */
    savedCount: (n: number) => `${n} saved`,
    drawFirstButton: "Draw a region",
    drawAnotherButton: "Draw another region",
    /** Drawing instructions on wider screens (mouse) */
    hintDesktop:
      "Click the map to add points and double-click to finish a shape. Or press and drag to draw freehand. Press Esc to cancel.",
    /** Drawing instructions on phones (touch) */
    hintMobile: "Tap to add points and double-tap to finish, or drag your finger to draw freehand.",
    /** Replaces the draw button once the per-visit limit is reached */
    limitReached: "That’s the most regions one visit can add. Thank you!",
    /** Only shown while no feature layer is configured; nothing is sent */
    testModeTitle: "Test mode",
    testModeMessage: "No feature layer is set, so regions are kept in this tab only and nothing is sent.",
  },

  list: {
    /** Shown before any regions are saved */
    empty: "Your saved regions appear here.",
    /** Screen-reader label for the list */
    label: "Your saved regions",
  },

  map: {
    /** Tooltip and screen-reader label for the button that zooms back to the lower 48 */
    homeButton: "Reset View",
    loadErrorTitle: "The map didn’t load",
    loadErrorMessage: "Please refresh the page to try again.",
  },

  regionDialog: {
    heading: "Name this region",
    description: "What do you call the area you outlined?",
    nameLabel: "Region name",
    namePlaceholder: "Region name",
    livesInLabel: "I live (or have lived) in this region",
    /** Second checkbox. Starts ticked once it has been ticked on any saved region this visit */
    fromUSLabel: "I live in (or have lived in) the United States",
    /** Label above the optional comments box */
    commentsLabel: "Comments (optional)",
    /** Grey hint text inside the empty comments box */
    commentsPlaceholder: "Add any comments about this region",
    /** Reminder that saved regions are final */
    lockedWarning: "Once saved, a region can’t be changed or removed.",
    saveButton: "Save region",
    /** Replaces the save button after a failed save */
    retryButton: "Try again",
    redrawButton: "Redraw",
    discardButton: "Discard",
    saveErrorTitle: "Couldn’t save",
    nameErrors: {
      empty: "Name this region",
      noLetters: "Names need at least one letter or number.",
    },
  },

  saveErrors: {
    /** Saving again within a few seconds; s = seconds left */
    tooSoon: (s: number) => `Please wait ${s} more seconds before saving another region.`,
    /** The feature service refused or couldn't be reached */
    failed: "Something went wrong on our end. Check your connection and try again.",
  },

  /** Alert shown when a drawn shape is rejected */
  shapeProblem: {
    title: "Let’s try that again",
    selfIntersecting: "That shape crosses over itself. Please draw it again.",
    tooDetailed: "That shape is too detailed. Try a simpler outline.",
    tooSmall: "That shape is too small. Zoom in if you're outlining a small area.",
  },

  /** Alert after a region is saved */
  savedAlert: (name: string) => `Saved “${name}”`,
  /** Screen-reader fallback label for alerts */
  alertLabel: "Notice",
};

export type AppCopy = typeof COPY;
// ────────────────────────────────────────────────────────────────────────────

// Calcite dark-mode brand, success and warning colours
const BRAND = [0, 154, 242];
const HOME = [54, 218, 67];
const DRAFT = [255, 201, 0];

const savedSymbol = new SimpleFillSymbol({
  color: [...BRAND, 0.22],
  outline: { color: [...BRAND, 1], width: 2 },
});

/** Regions the person said they live in */
const homeSymbol = new SimpleFillSymbol({
  color: [...HOME, 0.22],
  outline: { color: [...HOME, 1], width: 2 },
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
  // Once someone says they live in the US, assume so for their later regions
  const defaultFromUS = regions.some((r) => r.fromUS);

  // Draw saved regions from this tab's session (e.g. after a refresh)
  useEffect(() => {
    savedLayer.removeAll();
    for (const r of regions) {
      const polygon = polygonFromJson(r.geometry);
      savedLayer.addMany([
        new Graphic({ geometry: polygon, symbol: r.livesIn ? homeSymbol : savedSymbol }),
        labelGraphic(polygon, r.name),
      ]);
    }
  }, [regions, savedLayer]);

  useEffect(() => {
    void loadGeometryOperators();
    document.title = COPY.pageTitle;
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
      setToast({ kind: "warning", title: COPY.shapeProblem.title, message: COPY.shapeProblem[check.problem] });
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
      setSaveError(COPY.saveErrors.tooSoon(Math.ceil(wait / 1000)));
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
          fromUS: answer.fromUS,
          sessionId: getSessionId(),
          index,
          comments: answer.comments,
        });
      }
      lastSaveRef.current = Date.now();

      const region: SavedRegion = {
        localId: crypto.randomUUID(),
        index,
        name: answer.name,
        livesIn: answer.livesIn,
        fromUS: answer.fromUS,
        geometry: pending.polygon.toJSON(),
        savedAt: Date.now(),
      };
      const next = [...regions, region];
      setRegions(next);
      storeRegions(next);
      clearDraft();
      setToast({ kind: "success", title: COPY.savedAlert(answer.name) });
    } catch (err) {
      console.error(err);
      setSaveError(COPY.saveErrors.failed);
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
          heading={COPY.header.heading}
          description={isMobile ? undefined : COPY.header.description}
          icon="polygon-vertices"
        />
        <calcite-action
          slot="content-end"
          icon="information"
          text={COPY.header.aboutButton}
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
        <calcite-panel heading={COPY.panel.heading} description={COPY.panel.savedCount(regions.length)}>
          <div className="panel-body">
            {!isConfigured && (
              <calcite-notice open kind="warning" icon="exclamation-mark-triangle" width="full" scale="s">
                <div slot="title">{COPY.panel.testModeTitle}</div>
                <div slot="message">{COPY.panel.testModeMessage}</div>
              </calcite-notice>
            )}

            {atLimit ? (
              <calcite-notice open kind="info" icon="check-circle" width="full" scale="s">
                <div slot="message">{COPY.panel.limitReached}</div>
              </calcite-notice>
            ) : (
              <>
                <calcite-button width="full" iconStart="polygon" onClick={startDrawing}>
                  {regions.length ? COPY.panel.drawAnotherButton : COPY.panel.drawFirstButton}
                </calcite-button>
                <p className="hint">
                  {isMobile ? COPY.panel.hintMobile : COPY.panel.hintDesktop}
                </p>
              </>
            )}

            <RegionList regions={regions} copy={COPY.list} onZoom={zoomTo} />
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
          text={COPY.map.homeButton}
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

      <IntroDialog open={introOpen} copy={COPY.intro} onStart={() => setIntroOpen(false)} />

      <RegionDialog
        open={pending !== null}
        saving={saving}
        error={saveError}
        defaultFromUS={defaultFromUS}
        copy={COPY.regionDialog}
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
        label={toast?.title ?? COPY.alertLabel}
        oncalciteAlertClose={() => setToast(null)}
      >
        <div slot="title">{toast?.title}</div>
        {toast?.message && <div slot="message">{toast.message}</div>}
      </calcite-alert>

      <calcite-alert slot="alerts" open={mapError} kind="danger" icon label={COPY.map.loadErrorTitle}>
        <div slot="title">{COPY.map.loadErrorTitle}</div>
        <div slot="message">{COPY.map.loadErrorMessage}</div>
      </calcite-alert>
    </calcite-shell>
  );
}
