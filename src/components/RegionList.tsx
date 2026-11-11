import type { SavedRegion } from "../lib/session";

interface Props {
  regions: SavedRegion[];
  onZoom: (region: SavedRegion) => void;
}

export function RegionList({ regions, onZoom }: Props) {
  if (regions.length === 0) {
    return (
      <div className="empty-state">
        <calcite-icon icon="polygon" scale="l" />
        <p>Regions you save will appear here.</p>
      </div>
    );
  }

  return (
    <calcite-list label="Your saved regions" selectionMode="none">
      {regions.map((r) => (
        <calcite-list-item
          key={r.localId}
          label={r.name}
          description={r.livesIn ? "You live here" : undefined}
          oncalciteListItemSelect={() => onZoom(r)}
        >
          <calcite-icon slot="content-start" icon="polygon" scale="s" className="region-icon" />
          {r.livesIn && <calcite-icon slot="content-end" icon="home" scale="s" />}
        </calcite-list-item>
      ))}
    </calcite-list>
  );
}
