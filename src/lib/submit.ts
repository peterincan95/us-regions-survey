// Writes one region to the public, add-only feature layer view.
// The view lets anonymous users add features but not read, update or delete any,
// so nothing submitted by anyone ever comes back to the browser.

import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import Graphic from "@arcgis/core/Graphic.js";
import type Polygon from "@arcgis/core/geometry/Polygon.js";
import { config } from "../config";

let layer: FeatureLayer | null = null;

function getLayer() {
  layer ??= new FeatureLayer({ url: config.featureLayerUrl });
  return layer;
}

export interface RegionSubmission {
  polygon: Polygon;
  name: string;
  livesIn: boolean;
  sessionId: string;
  index: number;
  /** Optional; "" when left blank */
  comments: string;
}

export async function submitRegion(s: RegionSubmission): Promise<void> {
  if (!config.featureLayerUrl) {
    throw new Error("The survey isn't connected to a feature layer yet.");
  }
  const fl = getLayer();
  await fl.load();

  const { fields } = config;
  const attributes: Record<string, string | number> = {
    [fields.regionName]: s.name,
    [fields.livesIn]: s.livesIn ? 1 : 0,
    [fields.sessionId]: s.sessionId,
    [fields.polyIndex]: s.index,
    [fields.appVersion]: config.appVersion,
  };
  // Comments are optional, and the field may not exist on older layers: only
  // send them when there's text and somewhere to put it
  if (s.comments && fl.getField(fields.comments)) {
    attributes[fields.comments] = s.comments;
  }
  const feature = new Graphic({ geometry: s.polygon, attributes });

  const result = await fl.applyEdits({ addFeatures: [feature] });
  const added = result.addFeatureResults[0];
  if (!added || added.error) {
    throw new Error(added?.error?.message ?? "The region wasn't saved.");
  }
}
