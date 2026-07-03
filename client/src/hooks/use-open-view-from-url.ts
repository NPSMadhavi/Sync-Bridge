import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";

/** Open a record view when the URL contains `?view=<id>` (e.g. from notification navigation). */
export function useOpenViewFromUrl<T extends { id: number }>({
  items,
  isLoading,
  onOpen,
  param = "view",
}: {
  items: T[] | undefined;
  isLoading: boolean;
  onOpen: (item: T) => void;
  param?: string;
}) {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const onOpenRef = useRef(onOpen);
  const openedKeyRef = useRef<string | null>(null);

  onOpenRef.current = onOpen;

  useEffect(() => {
    if (isLoading) return;

    const params = new URLSearchParams(search);
    const viewId = params.get(param);
    if (!viewId) {
      openedKeyRef.current = null;
      return;
    }

    const openKey = `${param}:${viewId}`;
    if (openedKeyRef.current === openKey) return;

    const id = Number(viewId);
    if (!Number.isFinite(id) || !items?.length) return;

    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    openedKeyRef.current = openKey;
    onOpenRef.current(item);

    params.delete(param);
    const basePath = window.location.pathname;
    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${basePath}?${nextSearch}` : basePath;
    window.history.replaceState(null, "", nextUrl);
    setLocation(nextUrl);
  }, [items, isLoading, search, param, setLocation]);
}
