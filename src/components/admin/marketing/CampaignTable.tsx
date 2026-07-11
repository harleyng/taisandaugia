import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignRow } from "./CampaignRow";
import type { Campaign } from "@/types/marketing";

const PAGE_SIZE = 8;

interface Props {
  campaigns: Campaign[];
  isLoading: boolean;
  onView: (c: Campaign) => void;
  onCreate: () => void;
}

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

export function CampaignTable({ campaigns, isLoading, onView, onCreate }: Props) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [campaigns]);

  const totalPages = Math.max(1, Math.ceil(campaigns.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => campaigns.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [campaigns, page],
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Mã</th>
              <th className={TH}>Tên chiến dịch</th>
              <th className={TH}>Thời gian gửi</th>
              <th className={TH}>Người nhận</th>
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
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có chiến dịch nào.{" "}
                  <button className="text-primary underline" onClick={onCreate}>
                    Tạo chiến dịch đầu tiên
                  </button>
                </td>
              </tr>
            ) : (
              pageItems.map((c) => (
                <CampaignRow key={c.id} campaign={c} onView={() => onView(c)} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {campaigns.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">Tổng số: {campaigns.length}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Trang {page + 1}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
