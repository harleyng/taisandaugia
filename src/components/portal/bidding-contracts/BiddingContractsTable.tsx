import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Eye, EyeOff, Hash, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DepositStatusBadge } from "@/components/bidding-contracts/DepositStatusBadge";
import { VneidVerifiedBadge } from "@/components/vneid/VneidButton";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { maskIdNumber } from "@/lib/biddingContracts/filters";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { ID_TYPE_LABELS, type ContractWithSession } from "@/types/bidding-contract";

interface Props {
  rows: ContractWithSession[];
  showSession?: boolean;
  canUpdate: boolean;
  onDeposit: (row: ContractWithSession) => void;
  onBidderNo: (row: ContractWithSession) => void;
  emptyText?: string;
}

/** Bảng hồ sơ tham gia đã thanh toán — dùng ở chi tiết phiên và màn quản lý chung. */
export function BiddingContractsTable({ rows, showSession, canUpdate, onDeposit, onBidderNo, emptyText }: Props) {
  const navigate = useNavigate();
  // CCCD che mặc định; mở từng dòng khi cần đối chiếu.
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <div className="space-y-2 rounded-xl border border-dashed border-border p-8 text-center">
        <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyText ?? "Chưa có hồ sơ tham gia nào được thanh toán."}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hồ sơ</TableHead>
            <TableHead>Người đăng ký</TableHead>
            <TableHead>Giấy tờ</TableHead>
            {showSession && <TableHead>Phiên</TableHead>}
            <TableHead className="text-right">Tiền hồ sơ</TableHead>
            <TableHead className="text-center">Số báo danh</TableHead>
            <TableHead>Tiền đặt trước</TableHead>
            {canUpdate && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const sessionCancelled = row.auction_sessions?.status === "cancelled";
            const canAssign = row.deposit_status === "received" && !sessionCancelled;
            return (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">
                  <p className="font-mono text-sm font-medium text-foreground">{row.code}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(row.paid_at)}</p>
                  {sessionCancelled && (
                    <Badge variant="destructive" className="mt-1 text-[11px]">
                      Phiên đã huỷ
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="min-w-[12rem]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">{row.full_name}</span>
                    {row.identity_source === "vneid" && <VneidVerifiedBadge />}
                  </div>
                  <p className="text-xs text-muted-foreground">{row.phone}</p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <p className="text-xs text-muted-foreground">{ID_TYPE_LABELS[row.id_type]}</p>
                  <button
                    type="button"
                    onClick={() => toggleReveal(row.id)}
                    className="inline-flex items-center gap-1 font-mono text-sm text-foreground hover:text-primary"
                    aria-label={revealed.has(row.id) ? "Ẩn số giấy tờ" : "Hiện số giấy tờ"}
                  >
                    {revealed.has(row.id) ? row.id_number : maskIdNumber(row.id_number)}
                    {revealed.has(row.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </TableCell>
                {showSession && (
                  <TableCell className="min-w-[12rem]">
                    {row.auction_sessions ? (
                      <button
                        type="button"
                        className="text-left hover:text-primary"
                        onClick={() => navigate(`/portal/phien-dau-gia/${row.session_id}`)}
                      >
                        <p className="font-mono text-xs text-muted-foreground">{row.auction_sessions.code}</p>
                        <p className="text-sm font-medium text-foreground">{row.auction_sessions.title}</p>
                      </button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap text-right">{formatVnd(row.fee_amount)}</TableCell>
                <TableCell className="text-center text-base font-semibold text-foreground">
                  {formatBidderNo(row.bidder_no) ?? <span className="text-sm font-normal text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <DepositStatusBadge status={row.deposit_status} />
                  {row.deposit_amount_received != null && (
                    <p className="mt-1 text-xs text-muted-foreground">{formatVnd(row.deposit_amount_received)}</p>
                  )}
                </TableCell>
                {canUpdate && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeposit(row)}
                        title="Cập nhật tiền đặt trước"
                        aria-label="Cập nhật tiền đặt trước"
                        disabled={sessionCancelled && row.deposit_status !== "received"}
                      >
                        <Wallet className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onBidderNo(row)}
                        disabled={!canAssign}
                        title={
                          canAssign
                            ? "Cấp số báo danh"
                            : sessionCancelled
                              ? "Phiên đã huỷ"
                              : "Cấp số báo danh sau khi xác nhận đã nhận tiền đặt trước"
                        }
                        aria-label="Cấp số báo danh"
                      >
                        <Hash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
