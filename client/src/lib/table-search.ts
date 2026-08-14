export function matchesTableSearch(
  query: string,
  ...values: (string | null | undefined | number | boolean)[]
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((value) => value != null && String(value).toLowerCase().includes(q));
}

export const TABLE_SEARCH_ROUTES = [
  "/assets",
  "/employees",
  "/licenses",
  "/documents",
  "/company",
  "/vendors",
  "/customers",
  "/payroll",
] as const;

export function isTableSearchRoute(path: string): boolean {
  const basePath = path.split("?")[0];
  return TABLE_SEARCH_ROUTES.includes(basePath as (typeof TABLE_SEARCH_ROUTES)[number]);
}
