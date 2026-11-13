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

/**
 * Tidies optional comments like names, but keeps line breaks (at most one blank
 * line in a row). Returns "" when there's nothing left.
 */
export function cleanComments(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : " "))
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, config.limits.commentsMaxLength);
}

/** Why a name was rejected. The text shown for each is in COPY (App.tsx). */
export type NameProblem = "empty" | "noLetters";

export function nameProblem(raw: string): NameProblem | null {
  const name = cleanName(raw);
  if (name.length === 0) return "empty";
  if (!/[\p{L}\p{N}]/u.test(name)) return "noLetters";
  return null;
}
