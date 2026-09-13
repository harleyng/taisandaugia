import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { SaleStageBadge } from "@/components/sale-contracts/SaleStageBadge";
import { saleStageOf } from "@/lib/saleContracts/stage";
import { LOT_PAYMENT_STATUS_LABELS, type LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";
import type { ContractWithSession } from "@/types/bidding-contract";
import type { SaleContract } from "@/types/auction-sale-contract";

/**
 * Theo dõi người trúng thanh toán, hạn 30 ngày kể từ khi lô đóng
 * (_close_lot đặt payment_due_at = ends_at + 30 ngày).
 *
 * org_confirm_winner_payment là MỘT CHIỀU: nó chỉ nhận lô đang `pending` nên ghi
 * nhận xong không sửa lại được, và `_paid = false` tịch thu luôn tiền đặt trước.
 * Vì vậy cả hai nút đều phải qua hộp thoại xác nhận ở component cha.
 *
 * NĂM cột, không bảy: cạnh thanh bên trái chỉ còn ~1000px, mà hai nút thao tác
 * chiếm sẵn ~240px. Bảy cột đẩy cột thao tác ra ngoài màn hình — đúng lỗi đã vá
 * cho bảng điều hành lô ở Bước 5, và thao tác lại là thứ phải với tới được ngay.
 * Nên số lô, số báo danh và trạng thái xuống dòng phụ trong ô liền kề.
 *
 * TỪ GIAI ĐOẠN HỢP ĐỒNG MUA BÁN (20260914000001): khi lô đã có hợp đồng thì SỔ
 * TIỀN của hợp đồng là sự thật, nên nút "Đã thanh toán" biến mất và thay bằng
 * lối vào hợp đồng. Server cũng chặn bằng lý do `sale_contract_exists` — ẩn nút
 * chỉ là lớp ngoài. "Không thanh toán" vẫn giữ cho tổ chức chưa lập hợp đồng.
 */

interface Props {
  lots: AuctionSessionItem[];
  stateByLot: Map<string, LotState>;
  contracts: ContractWithSession[];
  canFinalize: boolean;
  now: Date;
  pendingLotId: string | null;
  onConfirm: (lot: AuctionSessionItem, paid: boolean) => void;
  /** Hợp đồng mua bán còn sống theo lô — quyết định cột thao tác hiện gì. */
  contractByLot: Map<string, SaleContract>;
  canManageSale: boolean;
  onCreateContract: (lot: AuctionSessionItem) => void;
  onOpenContract: (contract: SaleContract) => void;
}

export function WinnerPaymentCard({
  lots,
  stateByLot,
  contracts,
  canFinalize,
  now,
  pendingLotId,
  onConfirm,
  contractByLot,
  canManageSale,
  onCreateContract,
  onOpenContract,
}: Props) {
  const nameById = new Map(contracts.map((c) => [c.id, c.full_name]));
  const noById = new Map(contracts.map((c) => [c.id, c.bidder_no]));

  const sold = lots
    .map((lot) => ({ lot, state: stateByLot.get(lot.id) ?? null }))
    .filter((r) => r.state?.result === "sold");

  return (
    <Card className="rounded-2xl p-5">
      <h2 className="mb-1 font-semibold text-foreground">Thanh toán của người trúng đấu giá</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Người trúng nộp tiền trực tiếp cho tổ chức đấu giá. Ghi nhận ở đây không hoàn tác được.
      </p>

      {sold.length === 0 ? (
        <p className="text-sm text-muted-foreground">Phiên không có lô nào đấu giá thành.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lô tài sản</TableHead>
                <TableHead className="text-right">Giá trúng</TableHead>
                <TableHead>Người trúng</TableHead>
                <TableHead>Hạn thanh toán</TableHead>
                {canFinalize && <TableHead className="text-right">Thao tác</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sold.map(({ lot, state }) => {
                const status = state?.payment_status ?? null;
                const due = state?.payment_due_at ?? null;
                const overdue = status === "pending" && !!due && Date.parse(due) < now.getTime();
                const winnerId = state?.winner_contract_id ?? null;
                const name = winnerId ? nameById.get(winnerId) : null;
                const no = winnerId ? formatBidderNo(noById.get(winnerId) ?? null) : null;
                const contract = contractByLot.get(lot.id) ?? null;
                return (
                  <TableRow key={lot.id}>
                    <TableCell className="max-w-[200px]">
                      <p className="font-medium text-foreground">Lô {lot.lot_no}</p>
                      <p className="truncate text-xs text-muted-foreground">{lot.title}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-medium">
                      {state?.winning_amount != null ? formatVnd(state.winning_amount) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <p className="truncate">{name ?? "—"}</p>
                      {no && <p className="text-xs text-muted-foreground">SBD {no}</p>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className={overdue ? "text-destructive" : undefined}>{formatDateTime(due)}</p>
                      <Badge
                        className="mt-1"
                        variant={status === "paid" ? "default" : status === "defaulted" ? "destructive" : "outline"}
                      >
                        {overdue ? "Đã quá hạn" : status ? LOT_PAYMENT_STATUS_LABELS[status] : "—"}
                      </Badge>
                    </TableCell>
                    {canFinalize && (
                      <TableCell className="text-right">
                        {contract ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <SaleStageBadge stage={saleStageOf(contract)} />
                            <Button size="sm" variant="outline" onClick={() => onOpenContract(contract)}>
                              Mở hợp đồng
                            </Button>
                          </div>
                        ) : status === "pending" ? (
                          <div className="flex flex-col items-end gap-1.5 xl:flex-row xl:justify-end">
                            {canManageSale ? (
                              <Button
                                size="sm"
                                disabled={pendingLotId === lot.id}
                                onClick={() => onCreateContract(lot)}
                              >
                                Tạo hợp đồng
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pendingLotId === lot.id}
                              onClick={() => onConfirm(lot, false)}
                            >
                              Không thanh toán
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(state?.payment_confirmed_at ?? null)}
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
