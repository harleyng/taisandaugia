import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/advertising/slug";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";
import { ServiceContractAcceptDialog } from "./ServiceContractAcceptDialog";

/**
 * Nút "Thanh toán" của 4 thẻ đơn dịch vụ. Không đi thẳng tới VNPay: mở hợp đồng
 * để chủ tài sản đồng ý trước (HDCU), hộp thoại tự chuyển sang thanh toán.
 */
export function ServiceContractPayButton({
  kind,
  orderId,
  price,
}: {
  kind: ServiceKindKey;
  orderId: string;
  price: number | string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Thanh toán {formatVnd(price)}
      </Button>
      {open && <ServiceContractAcceptDialog kind={kind} orderId={orderId} open={open} onOpenChange={setOpen} />}
    </>
  );
}
