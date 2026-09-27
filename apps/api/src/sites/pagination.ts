/** Return the last visible row's identity when a read includes an extra row. */
export function nextPageCursor(
  rows: readonly { id: string }[],
  pageSize = 50,
): string | null {
  return rows.length > pageSize ? (rows[pageSize - 1]?.id ?? null) : null;
}
