// Cleans and checks a drawn polygon before it is saved.

import Extent from "@arcgis/core/geometry/Extent.js";
import Polygon from "@arcgis/core/geometry/Polygon.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import * as generalizeOperator from "@arcgis/core/geometry/operators/generalizeOperator.js";
import * as geodeticAreaOperator from "@arcgis/core/geometry/operators/geodeticAreaOperator.js";
import * as intersectsOperator from "@arcgis/core/geometry/operators/intersectsOperator.js";
import * as projectOperator from "@arcgis/core/geometry/operators/projectOperator.js";
import * as simplifyOperator from "@arcgis/core/geometry/operators/simplifyOperator.js";
import { config, US_BOXES } from "../config";

export type GeometryCheck =
  | { ok: true; polygon: Polygon }
  | { ok: false; message: string };

let loaded: Promise<void> | null = null;

/** Loads the operators that need it. Safe to call repeatedly. */
export function loadGeometryOperators() {
  loaded ??= Promise.all([projectOperator.projectLoad(), geodeticAreaOperator.geodeticAreaLoad()]).then(() => {});
  return loaded;
}

const usBoxes = US_BOXES.map(
  (b) => new Extent({ ...b, spatialReference: SpatialReference.WGS84 }),
);

function vertexCount(polygon: Polygon) {
  return polygon.rings.reduce((n, ring) => n + ring.length, 0);
}

/**
 * @param drawn  the polygon as sketched
 * @param pixelSize  map units per screen pixel when it was drawn, used to drop
 *   freehand detail no one could see
 */
export async function prepareGeometry(drawn: Polygon, pixelSize: number): Promise<GeometryCheck> {
  await loadGeometryOperators();
  const { limits } = config;

  const simple = simplifyOperator.simplifyExecute(drawn);
  if (!simple || simple.type !== "polygon" || (simple as Polygon).rings.length === 0) {
    return { ok: false, message: "That shape crosses over itself. Please draw it again." };
  }
  let polygon = simple as Polygon;

  // Keep about one-pixel accuracy at the scale it was drawn
  if (pixelSize > 0) {
    const generalized = generalizeOperator.generalizeExecute(polygon, pixelSize, { removeDegenerateParts: true });
    if (generalized && generalized.type === "polygon" && (generalized as Polygon).rings.length > 0) {
      polygon = generalized as Polygon;
    }
  }

  if (vertexCount(polygon) > limits.maxVertices) {
    return { ok: false, message: "That shape is too detailed. Try a simpler outline." };
  }

  const geographic = polygon.spatialReference.isWGS84
    ? polygon
    : (projectOperator.projectExecute(polygon, SpatialReference.WGS84) as Polygon | null);
  if (!geographic) {
    return { ok: false, message: "Something went wrong reading that shape. Please draw it again." };
  }

  if (!usBoxes.some((box) => intersectsOperator.intersectsExecute(geographic, box))) {
    return { ok: false, message: "Regions need to be in the United States." };
  }

  const areaKm2 = Math.abs(geodeticAreaOperator.geodeticAreaExecute(polygon, { unit: "square-kilometers" }));
  if (areaKm2 < limits.minAreaKm2) {
    return { ok: false, message: "That shape is too small. Zoom in if you're outlining a small area." };
  }
  if (areaKm2 > limits.maxAreaKm2) {
    return { ok: false, message: "That shape is bigger than the whole country. Try a smaller region." };
  }

  return { ok: true, polygon };
}

/** Rebuilds a polygon stored as JSON in the session. */
export function polygonFromJson(json: object) {
  return Polygon.fromJSON(json) as Polygon;
}
