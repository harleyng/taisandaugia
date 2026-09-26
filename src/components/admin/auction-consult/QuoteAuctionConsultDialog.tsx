import { useEffect, useState } from "react";
import { ServiceQuoteDialog } from "@/components/admin/service-requests/ServiceQuoteDialog";
import { ExpertAssignmentFields } from "@/components/admin/service-requests/ExpertAssignmentFields";
import { isValidAssignment } from "@/lib/serviceRequests/form";
import { saleGoalLabel } from "@/lib/auctionConsult/labels";
import { useAuctionConsultPartners, useQuoteAuctionConsult } from "@/hooks/useAdminAuctionConsultations";
import type { AuctionConsultation } from "@/types/auctionConsult";

/** Phân công chuyên gia + báo giá THAY đối tác. Báo lại / đổi chuyên gia được khi người bán chưa thanh toán. */
export function QuoteAuctionConsultDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AuctionConsultation;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const quote = useQuoteAuctionConsult();
  const { data: partners = [], isLoading } = useAuctionConsultPartners(open);
  const [assign, setAssign] = useState({ supplierId: "", expertName: "" });

  useEffect(() => {
    if (open) setAssign({ supplierId: row.supplier_id ?? "", expertName: row.expert_name ?? "" });
  }, [open, row.supplier_id, row.expert_name]);

  return (
    <ServiceQuoteDialog
      title={`${row.status === "quoted" ? "Báo giá lại" : "Phân công & báo giá"} · ${row.code}`}
      description={`Mục tiêu bán: ${saleGoalLabel(row.sale_goal)}. Người bán thấy tên chuyên gia, giá và thanh toán trong thời hạn hiệu lực.`}
      initial={{ price: row.quoted_price, note: row.quote_note }}
      pricePlaceholder="2,000,000"
      notePlaceholder="Phạm vi tư vấn, thời gian gửi đề xuất…"
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
        expertPlaceholder="VD: ThS. Nguyễn Văn A — Đấu giá viên"
        onChange={setAssign}
      />
    </ServiceQuoteDialog>
  );
}
