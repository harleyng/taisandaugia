import { useEffect, useState } from "react";
import { ServiceQuoteDialog } from "@/components/admin/service-requests/ServiceQuoteDialog";
import { ExpertAssignmentFields } from "@/components/admin/service-requests/ExpertAssignmentFields";
import { isValidAssignment } from "@/lib/serviceRequests/form";
import { useQuoteValuation, useValuationPartners } from "@/hooks/useAdminValuationOrders";
import { purposeLabel } from "@/lib/valuation/status";
import type { ValuationOrder } from "@/types/valuation";

/** Phân công đơn vị + thẩm định viên và báo giá THAY đối tác. Báo lại được khi người bán chưa thanh toán. */
export function QuoteValuationDialog({
  row,
  open,
  onOpenChange,
}: {
  row: ValuationOrder;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const quote = useQuoteValuation();
  const { data: partners = [], isLoading } = useValuationPartners(open);
  const [assign, setAssign] = useState({ supplierId: "", expertName: "" });

  useEffect(() => {
    if (open) setAssign({ supplierId: row.supplier_id ?? "", expertName: row.expert_name ?? "" });
  }, [open, row.supplier_id, row.expert_name]);

  return (
    <ServiceQuoteDialog
      title={`${row.status === "quoted" ? "Báo giá lại" : "Phân công & báo giá"} · ${row.code}`}
      description={`Mục đích: ${purposeLabel(row.purpose)}. Người bán thấy đơn vị, thẩm định viên, giá và thanh toán trong thời hạn hiệu lực.`}
      initial={{ price: row.quoted_price, note: row.quote_note }}
      pricePlaceholder="3,000,000"
      notePlaceholder="Phạm vi khảo sát, thời gian cấp chứng thư…"
      noteMaxLength={2000}
      extraValid={isValidAssignment(assign)}
      open={open}
      onOpenChange={onOpenChange}
      isPending={quote.isPending}
      onSubmit={(t) =>
        quote.mutateAsync({ id: row.id, supplierId: assign.supplierId, expertName: assign.expertName.trim(), ...t })
      }
    >
      <ExpertAssignmentFields
        partners={partners}
        isLoading={isLoading}
        supplierId={assign.supplierId}
        expertName={assign.expertName}
        expertPlaceholder="VD: TĐV. Nguyễn Văn A"
        onChange={setAssign}
      />
    </ServiceQuoteDialog>
  );
}
