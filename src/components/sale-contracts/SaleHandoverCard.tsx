import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContractFileButton } from "@/components/consignment/ContractFileButton";
import { SALE_BUCKET } from "@/lib/saleContracts/files";
import { canConfirmHandover, canScheduleHandover, canSetTitleTransfer, hasConfirmedHandover } from "@/lib/saleContracts/stage";
import { formatDate } from "@/lib/dateUtils";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import {
  SALE_SIDE_LABELS,
  SALE_TITLE_TRANSFER_LABELS,
  type SaleContract,
  type SaleSide,
} from "@/types/auction-sale-contract";

/** Bàn giao (hai bên xác nhận) + sang tên (tổ chức ghi nhận). */
export function SaleHandoverCard({
  contract, sides, onSchedule, onConfirm, onTitleTransfer,
}: {
  contract: SaleContract;
  sides: SaleSide[];
  onSchedule?: () => void;
  onConfirm?: (side: SaleSide) => void;
  onTitleTransfer?: () => void;
}) {
  const scheduleSide = sides.find((s) => canScheduleHandover(contract, s));
  const confirmSides = sides.filter((s) => canConfirmHandover(contract, s));
  const titleSide = sides.find((s) => canSetTitleTransfer(contract, s));
  const notPaid = !contract.paid_at;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Bàn giao và sang tên</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Lịch bàn giao</dt>
            <dd>{contract.handover_scheduled_at ? formatDateTime(contract.handover_scheduled_at) : "Chưa hẹn"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Địa điểm</dt>
            <dd>{contract.handover_location || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Hạn bàn giao</dt>
            <dd>{contract.handover_due_at ? formatDate(contract.handover_due_at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Đã bàn giao</dt>
            <dd>{contract.handed_over_at ? formatDateTime(contract.handed_over_at) : "Chưa"}</dd>
          </div>
        </dl>

        <div className="space-y-1 text-sm">
          {(["buyer", "seller"] as SaleSide[]).map((s) => (
            <div key={s} className="flex flex-wrap items-center gap-2">
              <span className="min-w-[7rem] text-muted-foreground">{SALE_SIDE_LABELS[s]}</span>
              {hasConfirmedHandover(contract, s) ? (
                <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                  đã xác nhận
                </Badge>
              ) : (
                <span className="text-muted-foreground">chưa xác nhận</span>
              )}
            </div>
          ))}
        </div>

        {contract.handover_doc_path ? (
          <ContractFileButton path={contract.handover_doc_path} bucket={SALE_BUCKET} label="Mở biên bản bàn giao" />
        ) : null}

        {notPaid && contract.status === "signed" ? (
          <p className="text-xs text-muted-foreground">
            Tài sản được bàn giao sau khi bên mua thanh toán đủ tiền mua.
          </p>
        ) : null}

        {scheduleSide || confirmSides.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {scheduleSide && onSchedule ? (
              <Button type="button" size="sm" variant="outline" onClick={onSchedule}>
                {contract.handover_scheduled_at ? "Đổi lịch bàn giao" : "Hẹn lịch bàn giao"}
              </Button>
            ) : null}
            {confirmSides.map((s) =>
              onConfirm ? (
                <Button key={s} type="button" size="sm" disabled={notPaid} onClick={() => onConfirm(s)}>
                  Xác nhận đã bàn giao ({SALE_SIDE_LABELS[s].toLowerCase()})
                </Button>
              ) : null,
            )}
          </div>
        ) : null}

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Đăng ký sang tên: </span>
            <span className="font-medium">{SALE_TITLE_TRANSFER_LABELS[contract.title_transfer_status]}</span>
            {contract.title_transfer_note ? (
              <p className="mt-1 text-xs text-muted-foreground">{contract.title_transfer_note}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {contract.title_transfer_doc_path ? (
              <ContractFileButton path={contract.title_transfer_doc_path} bucket={SALE_BUCKET} label="Giấy tờ" />
            ) : null}
            {titleSide && onTitleTransfer ? (
              <Button type="button" size="sm" variant="outline" onClick={onTitleTransfer}>
                Cập nhật
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
