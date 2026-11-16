// Per-tab session. sessionStorage is cleared when the tab closes, so the ID and
// the list of saved regions never outlive the visit or reach another tab.

export interface SavedRegion {
  /** Local ID for React keys; never sent anywhere */
  localId: string;
  index: number;
  name: string;
  livesIn: boolean;
  /** Missing on regions saved before this question was added */
  fromUS?: boolean;
  /** Polygon as JSON in the view's spatial reference */
  geometry: object;
  savedAt: number;
}

const ID_KEY = "usRegions.sessionId";
const REGIONS_KEY = "usRegions.regions";

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode etc.); the session simply won't survive a refresh
  }
}

let memoryId: string | null = null;

/** Random, anonymous ID for this tab. Lets the polygons from one visit be grouped. */
export function getSessionId(): string {
  const stored = safeGet(ID_KEY);
  if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
  memoryId ??= crypto.randomUUID();
  safeSet(ID_KEY, memoryId);
  return memoryId;
}

export function loadRegions(): SavedRegion[] {
  const raw = safeGet(REGIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function storeRegions(regions: SavedRegion[]) {
  safeSet(REGIONS_KEY, JSON.stringify(regions));
}
