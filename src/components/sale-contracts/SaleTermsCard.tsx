import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dateUtils";
import { SALE_PAYEE_LABELS, type SaleContract } from "@/types/auction-sale-contract";

const DASH = "—";

/** Điều khoản thương mại — tổ chức sửa khi chưa ký, các bên chỉ đọc. */
export function SaleTermsCard({
  contract, canEdit, editBlockedNote, onEdit,
}: {
  contract: SaleContract;
  canEdit: boolean;
  /** Vì sao không sửa được (vd. đã có tiền vào sổ) — hiện thay cho nút. */
  editBlockedNote?: string | null;
  onEdit?: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["Số hợp đồng", contract.contract_no || DASH],
    ["Bên nhận tiền", SALE_PAYEE_LABELS[contract.payee_side]],
    ["Thông tin nhận tiền", contract.payee_bank_info || DASH],
    ["Hạn ký hợp đồng", contract.sign_due_at ? formatDate(contract.sign_due_at) : DASH],
    ["Hạn bàn giao", contract.handover_due_at ? formatDate(contract.handover_due_at) : DASH],
    ["Công chứng", contract.notarization_required ? "Có" : "Không"],
    ["Tổ chức ký chứng kiến", contract.org_signs ? "Có" : "Không"],
  ];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <CardTitle className="text-base">Điều khoản</CardTitle>
        {canEdit && onEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            Sửa điều khoản
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid gap-2 sm:grid-cols-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-wrap gap-x-2">
              <dt className="min-w-[9rem] text-muted-foreground">{k}</dt>
              <dd className="flex-1 break-words">{v}</dd>
            </div>
          ))}
        </dl>
        {!canEdit && editBlockedNote ? (
          <p className="text-xs text-muted-foreground">{editBlockedNote}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
