// Cleans and checks a drawn polygon before it is saved.

import Polygon from "@arcgis/core/geometry/Polygon.js";
import * as generalizeOperator from "@arcgis/core/geometry/operators/generalizeOperator.js";
import * as geodeticAreaOperator from "@arcgis/core/geometry/operators/geodeticAreaOperator.js";
import * as simplifyOperator from "@arcgis/core/geometry/operators/simplifyOperator.js";
import { config } from "../config";

/** Why a drawn shape was rejected. The text shown for each is in COPY (App.tsx). */
export type GeometryProblem = "selfIntersecting" | "tooDetailed" | "tooSmall";

export type GeometryCheck =
  | { ok: true; polygon: Polygon }
  | { ok: false; problem: GeometryProblem };

let loaded: Promise<void> | null = null;

/** Loads the operators that need it. Safe to call repeatedly. */
export function loadGeometryOperators() {
  loaded ??= geodeticAreaOperator.geodeticAreaLoad();
  return loaded;
}

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
    return { ok: false, problem: "selfIntersecting" };
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
    return { ok: false, problem: "tooDetailed" };
  }

  const areaKm2 = Math.abs(geodeticAreaOperator.geodeticAreaExecute(polygon, { unit: "square-kilometers" }));
  if (areaKm2 < limits.minAreaKm2) {
    return { ok: false, problem: "tooSmall" };
  }

  return { ok: true, polygon };
}

/** Rebuilds a polygon stored as JSON in the session. */
export function polygonFromJson(json: object) {
  return Polygon.fromJSON(json) as Polygon;
}
