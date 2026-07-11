import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdRow } from "./AdRow";
import type { Advertisement } from "@/types/advertising";

const PAGE_SIZE = 8;

interface Props {
  ads: Advertisement[];
  isLoading: boolean;
  onView: (a: Advertisement) => void;
  onCreate: () => void;
}

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

export function AdTable({ ads, isLoading, onView, onCreate }: Props) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [ads]);

  const totalPages = Math.max(1, Math.ceil(ads.length / PAGE_SIZE));
  const pageItems = useMemo(() => ads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [ads, page]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Mã</th>
              <th className={TH}>Tên banner</th>
              <th className={TH}>Vị trí</th>
              <th className={TH}>Thời gian tạo</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : ads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có banner nào.{" "}
                  <button className="text-primary underline" onClick={onCreate}>
                    Tạo banner đầu tiên
                  </button>
                </td>
              </tr>
            ) : (
              pageItems.map((a) => <AdRow key={a.id} ad={a} onView={() => onView(a)} />)
            )}
          </tbody>
        </table>
      </div>

      {ads.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">Tổng số: {ads.length}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Trang {page + 1}/{totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
