import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssignBidderNoDialog } from "@/components/portal/bidding-contracts/AssignBidderNoDialog";
import { BiddingContractsTable } from "@/components/portal/bidding-contracts/BiddingContractsTable";
import { ContractDepositDialog } from "@/components/portal/bidding-contracts/ContractDepositDialog";
import { ContractReviewSheet } from "@/components/portal/bidding-contracts/ContractReviewSheet";
import { useSessionOrg } from "@/hooks/useAuctionSessions";
import { useOrgBiddingContracts } from "@/hooks/useOrgBiddingContracts";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import {
  ALL_SESSIONS,
  EMPTY_CONTRACT_FILTERS,
  filterOrgContracts,
  type OrgContractFilters,
} from "@/lib/biddingContracts/filters";
import {
  DEPOSIT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  type ContractWithSession,
  type DepositStatus,
  type ReviewStatus,
} from "@/types/bidding-contract";

/** /portal/ho-so-tham-gia — hồ sơ tham gia đã thanh toán (và đã từ chối) của tổ chức. */
export default function HoSoThamGiaPage() {
  const [searchParams] = useSearchParams();
  const { loading: orgLoading } = useSessionOrg();
  const { data: rows = [], isLoading, error } = useOrgBiddingContracts();
  const canUpdate = useHasOrgPermission("ho-so-tham-gia", "update");
  const [filters, setFilters] = useState<OrgContractFilters>(() => ({
    ...EMPTY_CONTRACT_FILTERS,
    sessionId: searchParams.get("session") ?? ALL_SESSIONS,
  }));
  const [depositFor, setDepositFor] = useState<ContractWithSession | null>(null);
  const [bidderFor, setBidderFor] = useState<ContractWithSession | null>(null);
  // Giữ id chứ không giữ object: sau mỗi lần duyệt danh sách tải lại, sheet hiện bản mới.
  const [reviewId, setReviewId] = useState<string | null>(null);

  // Lấy danh sách phiên từ chính hồ sơ: người chỉ có quyền hồ sơ (không có quyền
  // phiên) vẫn lọc được.
  const sessions = useMemo(() => {
    const map = new Map<string, NonNullable<ContractWithSession["auction_sessions"]>>();
    for (const r of rows) if (r.auction_sessions) map.set(r.session_id, r.auction_sessions);
    return [...map.values()].sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  }, [rows]);

  const visible = useMemo(() => filterOrgContracts(rows, filters), [rows, filters]);
  const paid = rows.filter((r) => r.status === "paid");
  const awaitingReview = paid.filter((r) => r.review_status === "pending").length;
  const received = paid.filter((r) => r.deposit_status === "received").length;
  const numbered = paid.filter((r) => r.bidder_no != null).length;
  const patch = (p: Partial<OrgContractFilters>) => setFilters((f) => ({ ...f, ...p }));

  if (orgLoading || isLoading) {
    return (
      <div className="px-6 py-6">
        <Card className="flex items-center justify-center gap-2 rounded-2xl p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải hồ sơ tham gia…
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-6">
        <Card className="space-y-3 rounded-2xl p-10 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Không tải được hồ sơ tham gia. Vui lòng tải lại trang.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-6 py-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Hồ sơ tham gia đấu giá</h1>
        <p className="text-sm text-muted-foreground">
          Người mua đã thanh toán tiền hồ sơ qua sàn. Duyệt hồ sơ và xác nhận tiền đặt trước; số báo danh được cấp khi
          người tham gia điểm danh.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Hồ sơ đã bán", value: paid.length },
          { label: "Chờ duyệt", value: awaitingReview },
          { label: "Đã nhận tiền đặt trước", value: received },
          { label: "Đã cấp số báo danh", value: numbered },
        ].map((s) => (
          <Card key={s.label} className="rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 rounded-2xl p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_14rem_12rem_14rem]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder="Tìm theo tên, SĐT, CCCD, mã hồ sơ, số báo danh"
              className="pl-9"
            />
          </div>
          <Select value={filters.sessionId} onValueChange={(v) => patch({ sessionId: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SESSIONS}>Tất cả phiên</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.code} · {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.review} onValueChange={(v) => patch({ review: v as ReviewStatus | "all" })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi trạng thái duyệt</SelectItem>
              {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.deposit} onValueChange={(v) => patch({ deposit: v as DepositStatus | "all" })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi trạng thái đặt trước</SelectItem>
              {Object.entries(DEPOSIT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <BiddingContractsTable
          rows={visible}
          showSession
          canUpdate={canUpdate}
          onReview={(r) => setReviewId(r.id)}
          onDeposit={setDepositFor}
          onBidderNo={setBidderFor}
          emptyText={rows.length === 0 ? undefined : "Không có hồ sơ khớp bộ lọc."}
        />
      </Card>

      <ContractReviewSheet
        contract={rows.find((r) => r.id === reviewId) ?? null}
        onOpenChange={(open) => !open && setReviewId(null)}
      />
      {canUpdate && (
        <>
          <ContractDepositDialog contract={depositFor} onOpenChange={(open) => !open && setDepositFor(null)} />
          <AssignBidderNoDialog contract={bidderFor} onOpenChange={(open) => !open && setBidderFor(null)} />
        </>
      )}
    </div>
  );
}
