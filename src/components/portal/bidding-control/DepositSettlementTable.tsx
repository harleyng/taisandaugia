import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DepositStatusBadge } from "@/components/bidding-contracts/DepositStatusBadge";
import { formatVnd } from "@/lib/advertising/slug";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import type { ContractWithSession } from "@/types/bidding-contract";

/**
 * Xử lý tiền đặt trước sau khi chốt phiên.
 *
 * QUYỀN KHÁC MODULE: org_mark_deposit_refunded gác ở `ho-so-tham-gia`.update,
 * không phải `dieu-hanh-dau-gia` như mọi thứ còn lại trên màn này — hoàn tiền là
 * nghiệp vụ hồ sơ. Thiếu quyền thì nói ra tên quyền, đừng bày nút xám: người
 * dùng không đoán được mình thiếu gì.
 *
 * BA cột thôi. Thẻ này chỉ chiếm nửa lưới (~470px) mà nhãn "Chuyển vào tiền mua
 * tài sản" một dòng đã ~200px: để nó thành cột riêng thì cột thao tác bị đẩy ra
 * ngoài vùng cuộn — nút "Đã hoàn" vẫn trong DOM nhưng người dùng không thấy.
 * Cho nó tự xuống dòng cũng không được: Badge bo tròn nên nhiều dòng biến thành
 * một cục tròn. Vì vậy số tiền và trạng thái nằm dưới họ tên.
 */

/** Chỉ các trạng thái CHỐT SỔ — 'pending' / 'received' thuộc màn hồ sơ tham gia. */
const SETTLED = new Set(["applied", "pending_refund", "refunded", "forfeited"]);

interface Props {
  contracts: ContractWithSession[];
  canRefund: boolean;
  pendingContractId: string | null;
  onRefund: (contract: ContractWithSession) => void;
}

export function DepositSettlementTable({ contracts, canRefund, pendingContractId, onRefund }: Props) {
  const rows = contracts
    .filter((c) => c.status === "paid" && SETTLED.has(c.deposit_status))
    .sort((a, b) => (a.bidder_no ?? 0) - (b.bidder_no ?? 0));

  const waiting = rows.filter((r) => r.deposit_status === "pending_refund").length;

  return (
    <Card className="rounded-2xl p-5">
      <h2 className="mb-1 font-semibold text-foreground">Tiền đặt trước</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {waiting > 0 ? `${waiting} hồ sơ chờ hoàn trả.` : "Không còn hồ sơ nào chờ hoàn trả."}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có hồ sơ nào được chốt sổ tiền đặt trước.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">SBD</TableHead>
                <TableHead>Người tham gia</TableHead>
                {canRefund && <TableHead className="text-right">Thao tác</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono align-top">{formatBidderNo(c.bidder_no) ?? "—"}</TableCell>
                  <TableCell className="space-y-1 align-top">
                    <p className="truncate font-medium text-foreground">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.deposit_amount_received != null ? formatVnd(c.deposit_amount_received) : "—"}
                    </p>
                    <DepositStatusBadge status={c.deposit_status} className="whitespace-nowrap" />
                  </TableCell>
                  {canRefund && (
                    <TableCell className="text-right align-top">
                      {c.deposit_status === "pending_refund" && (
                        <Button size="sm" variant="outline" disabled={pendingContractId === c.id} onClick={() => onRefund(c)}>
                          Đã hoàn
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!canRefund && rows.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Cần quyền <strong>Hồ sơ tham gia đấu giá · Sửa</strong> để ghi nhận hoàn trả tiền đặt trước.
        </p>
      )}
    </Card>
  );
}
