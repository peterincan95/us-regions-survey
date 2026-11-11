import { config } from "../config";

/**
 * Tidies a region name: removes control and zero-width characters, collapses
 * whitespace and trims to the field's length. Names are only ever shown as text,
 * never as HTML.
 */
export function cleanName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, config.limits.nameMaxLength);
}

export function nameError(raw: string): string | null {
  const name = cleanName(raw);
  if (name.length === 0) return "Give this region a name.";
  if (!/[\p{L}\p{N}]/u.test(name)) return "Names need at least one letter or number.";
  return null;
}
