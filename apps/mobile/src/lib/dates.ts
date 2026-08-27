/**
 * Date helpers shared by onboarding and the profile's move-date editor.
 *
 * Both need the same local-date serialisation, and getting it wrong is silent: the checklist
 * is generated from this one value, so a one-day drift moves every deadline.
 */

/**
 * `YYYY-MM-DD` in the device's own timezone.
 *
 * Deliberately not `toISOString()`: that converts to UTC first, which rolls the date back a
 * day for anyone east of Greenwich — including everyone already in Japan.
 */
export function toLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "1 Sep 2026" — for confirmation text and the profile row. */
export function formatMoveDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Parses the API's `YYYY-MM-DD` as a LOCAL date, not a UTC midnight that shifts. */
export function parseLocalIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}
