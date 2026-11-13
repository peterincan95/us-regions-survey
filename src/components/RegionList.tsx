import type { AppCopy } from "../App";
import type { SavedRegion } from "../lib/session";

interface Props {
  regions: SavedRegion[];
  copy: AppCopy["list"];
  onZoom: (region: SavedRegion) => void;
}

export function RegionList({ regions, copy, onZoom }: Props) {
  if (regions.length === 0) {
    return (
      <div className="empty-state">
        <calcite-icon icon="polygon" scale="l" />
        <p>{copy.empty}</p>
      </div>
    );
  }

  return (
    <calcite-list label={copy.label} selectionMode="none">
      {regions.map((r) => (
        <calcite-list-item
          key={r.localId}
          label={r.name}
          oncalciteListItemSelect={() => onZoom(r)}
        >
          <calcite-icon
            slot="content-start"
            icon="polygon"
            scale="s"
            className={r.livesIn ? "region-icon region-icon--home" : "region-icon"}
          />
          {r.livesIn && (
            <calcite-icon slot="content-end" icon="home" scale="s" className="region-icon--home" />
          )}
        </calcite-list-item>
      ))}
    </calcite-list>
  );
}
