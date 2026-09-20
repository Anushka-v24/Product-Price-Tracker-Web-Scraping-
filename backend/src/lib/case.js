/** Postgres uses snake_case, JavaScript uses camelCase. Convert rows on the way out. */
const toCamelKey = (key) => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export function toCamel(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamelKey(k), v]));
}

export const rowsToCamel = (rows) => rows.map(toCamel);
