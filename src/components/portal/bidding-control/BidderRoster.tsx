import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { DEPOSIT_STATUS_LABELS } from "@/types/bidding-contract";
import type { RosterRow } from "@/lib/biddingContracts/filters";

/**
 * Ai đang đủ điều kiện trả giá trong phiên này.
 *
 * CỐ Ý không dùng lại BiddingContractsTable: bảng đó là màn QUẢN TRỊ hồ sơ
 * (CCCD, xác nhận tiền đặt trước, cấp số báo danh) và đã có sẵn ở trang chi
 * tiết phiên. Giữa phiên đang chạy, đấu giá viên cần một danh sách ngắn — và
 * cần cột "đang dẫn đầu", thứ bảng kia không tính được vì không đọc trạng thái lô.
 */

interface Props {
  rows: RosterRow[];
  isLoading: boolean;
  /** Thiếu quyền ho-so-tham-gia.view thì RLS trả 0 dòng — phải nói rõ. */
  canView: boolean;
  onManage: () => void;
}

export function BidderRoster({ rows, isLoading, canView, onManage }: Props) {
  const eligible = rows.filter((r) => r.eligible).length;

  return (
    <Card className="rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">Người tham gia</h2>
          {/* Chưa tải xong thì KHÔNG hiện "0/0": giữa phiên đấu giá, con số đó
              đọc ra thành "không ai đủ điều kiện" chứ không ai hiểu là đang tải. */}
          {canView && (
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Đang tải hồ sơ…" : `${eligible}/${rows.length} hồ sơ đủ điều kiện trả giá`}
            </p>
          )}
        </div>
        {canView && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onManage}>
            Quản lý hồ sơ
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!canView ? (
        // Nếu chỉ im lặng hiện danh sách rỗng thì người điều hành sẽ tin là
        // "chưa ai đăng ký" — một lời nói dối nguy hiểm giữa phiên đấu giá.
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Bạn không có quyền xem hồ sơ tham gia nên danh sách này bị ẩn. Cần quyền{" "}
          <strong>Hồ sơ tham gia đấu giá · Xem</strong>.
        </p>
      ) : isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : !rows.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Chưa có ai mua hồ sơ phiên này.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.contractId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  <span className="tabular-nums text-muted-foreground">{formatBidderNo(r.bidderNo) ?? "—"}</span>{" "}
                  {r.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tiền đặt trước: {DEPOSIT_STATUS_LABELS[r.depositStatus]}
                  {r.bidderNo == null && " · chưa cấp số báo danh"}
                </p>
              </div>
              {r.leadingLots > 0 ? (
                <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
                  Dẫn đầu {r.leadingLots} lô
                </Badge>
              ) : !r.eligible ? (
                <Badge variant="outline" className="border-muted bg-muted text-muted-foreground">
                  Chưa đủ điều kiện
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
