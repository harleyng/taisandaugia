import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContractFileButton } from "@/components/consignment/ContractFileButton";
import { SALE_BUCKET } from "@/lib/saleContracts/files";
import {
  awaitingSigningSides, canAttachSigned, canCancel, canConfirmSigned, canShareDraft, hasConfirmedSigning,
} from "@/lib/saleContracts/stage";
import { formatDate } from "@/lib/dateUtils";
import { SALE_SIDE_LABELS, type SaleContract, type SaleSide } from "@/types/auction-sale-contract";

/**
 * Dự thảo → bản ký → xác nhận. Người xem có thể đóng NHIỀU vai cùng lúc (tổ
 * chức ký thay bên bán, lại còn là bên ký thứ ba), nên nút xác nhận hiện THEO
 * TỪNG VAI mà họ được phép và còn chưa xác nhận.
 */
export function SaleDocumentsCard({
  contract, sides, onShareDraft, onAttachSigned, onConfirm, onCancel,
}: {
  contract: SaleContract;
  /** Các vai người đang xem được phép đóng (suy từ `can_act` của RPC). */
  sides: SaleSide[];
  onShareDraft?: () => void;
  onAttachSigned?: (side: SaleSide) => void;
  onConfirm?: (side: SaleSide) => void;
  onCancel?: (side: SaleSide) => void;
}) {
  const waiting = awaitingSigningSides(contract);
  const shareSide = sides.find((s) => canShareDraft(contract, s));
  const attachSide = sides.find((s) => canAttachSigned(contract, s));
  const confirmSides = sides.filter((s) => canConfirmSigned(contract, s));
  const cancelSide = canCancel(contract) ? sides[0] : undefined;

  const requiredSides: SaleSide[] = contract.org_signs
    ? ["buyer", "seller", "org"]
    : ["buyer", "seller"];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Hồ sơ hợp đồng</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[6rem] text-sm text-muted-foreground">Dự thảo</span>
            {contract.draft_doc_path ? (
              <>
                <ContractFileButton path={contract.draft_doc_path} bucket={SALE_BUCKET} label="Mở dự thảo" />
                {contract.draft_source === "generated" ? (
                  <Badge variant="outline" className="text-xs font-normal">
                    dựng tự động
                  </Badge>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Chưa có</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[6rem] text-sm text-muted-foreground">Bản đã ký</span>
            {contract.signed_doc_path ? (
              <>
                <ContractFileButton path={contract.signed_doc_path} bucket={SALE_BUCKET} label="Mở bản đã ký" />
                {contract.signed_date ? (
                  <span className="text-xs text-muted-foreground">ký ngày {formatDate(contract.signed_date)}</span>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Chưa có</span>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">Xác nhận của các bên</p>
          <ul className="space-y-1 text-sm">
            {requiredSides.map((s) => (
              <li key={s} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[7rem] text-muted-foreground">{SALE_SIDE_LABELS[s]}</span>
                {hasConfirmedSigning(contract, s) ? (
                  <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                    đã xác nhận
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">chưa xác nhận</span>
                )}
              </li>
            ))}
          </ul>
          {waiting.length > 0 && contract.status === "awaiting_confirmation" ? (
            <p className="text-xs text-muted-foreground">
              Đang chờ: {waiting.map((s) => SALE_SIDE_LABELS[s].toLowerCase()).join(", ")}.
            </p>
          ) : null}
        </div>

        {shareSide || attachSide || confirmSides.length > 0 || cancelSide ? (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {shareSide && onShareDraft ? (
                <Button type="button" size="sm" onClick={onShareDraft}>
                  {contract.draft_doc_path ? "Chia sẻ dự thảo mới" : "Chia sẻ dự thảo"}
                </Button>
              ) : null}
              {attachSide && onAttachSigned ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onAttachSigned(attachSide)}>
                  {contract.signed_doc_path ? "Thay bản đã ký" : "Tải lên bản đã ký"}
                </Button>
              ) : null}
              {confirmSides.map((s) =>
                onConfirm ? (
                  <Button key={s} type="button" size="sm" onClick={() => onConfirm(s)}>
                    Xác nhận ({SALE_SIDE_LABELS[s].toLowerCase()})
                  </Button>
                ) : null,
              )}
              {cancelSide && onCancel ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onCancel(cancelSide)}
                >
                  Huỷ hợp đồng
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
