import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_PAGE_SIZE = 10;

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

function getVisiblePages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);
  return pages;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {visiblePages.map((pageNumber, index) =>
          pageNumber === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-9 w-9 items-center justify-center text-muted-foreground"
              aria-hidden
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : (
            <Button
              key={pageNumber}
              type="button"
              variant={page === pageNumber ? "default" : "outline"}
              size="icon"
              className={cn(
                "h-9 w-9",
                page === pageNumber && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              onClick={() => onPageChange(pageNumber)}
              aria-label={`Page ${pageNumber}`}
              aria-current={page === pageNumber ? "page" : undefined}
            >
              {pageNumber}
            </Button>
          )
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function usePaginatedItems<T>(
  items: T[],
  resetDeps: unknown[] = [],
  pageSize = DEFAULT_PAGE_SIZE
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    // Reset to first page when filters or data length change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, ...resetDeps]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return {
    page: safePage,
    setPage,
    paginatedItems: paginateItems(items, safePage, pageSize),
    pageSize,
    totalItems: items.length,
  };
}
