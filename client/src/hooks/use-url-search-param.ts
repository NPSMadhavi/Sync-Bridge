import { useSearch } from "wouter";

/** Reads `?q=` (or another param) from the URL and updates when query params change. */
export function useUrlSearchParam(param = "q") {
  const search = useSearch();
  const params = new URLSearchParams(search);
  return params.get(param) || "";
}
