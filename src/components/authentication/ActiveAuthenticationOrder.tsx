import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarClock, ExternalLink, Package, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { useCancelAuthentication, useSubmitAuthenticationShipment } from "@/hooks/useAuthenticationOrders";
import { formatVnd } from "@/lib/advertising/slug";
import { gdMethodLabel, isQuoteExpired } from "@/lib/authentication/status";
import { ADMIN_AUTHENTICATION_PATH } from "@/lib/authentication/paths";
import { ServiceContractPayButton } from "@/components/service-contracts/ServiceContractPayButton";
import type { AuthenticationOrder } from "@/types/authentication";
import { AuthenticationStatusStepper } from "./AuthenticationStatusStepper";

const when = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm, dd/MM/yyyy", { locale: vi }) : "—");

/** Đơn giám định đang chạy: tiến trình + việc người bán cần làm (trả tiền, gửi hiện vật). */
export function ActiveAuthenticationOrder({ order, mode }: { order: AuthenticationOrder; mode: "owner" | "admin" }) {
  const navigate = useNavigate();
  const cancel = useCancelAuthentication();
  const expired = isQuoteExpired(order);
  const { userId } = useAuth();
  // Người xem / Cán bộ ngoài phạm vi chỉ đọc; chỉ NGƯỜI GỬI yêu cầu thanh toán (_settle_* kiểm user_id).
  const canWrite = usePostingCanWrite();
  const owner = mode === "owner" && canWrite;
  const isRequester = order.user_id === userId;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Đơn <span className="font-mono font-semibold text-foreground">{order.code}</span> ·{" "}
          {gdMethodLabel(order.method)} · {order.partner_name}
        </span>
        {mode === "admin" && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => navigate(`${ADMIN_AUTHENTICATION_PATH}/${order.id}`)}
          >
            Mở đơn <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
      <AuthenticationStatusStepper status={order.status} method={order.method} />

      <div className="text-sm text-foreground">
        {order.status === "requested" && <p>Sàn đang xem yêu cầu và sẽ gửi báo giá sớm.</p>}

        {order.status === "quoted" && (
          <div className="space-y-1">
            <p>
              Báo giá: <span className="font-semibold text-primary">{formatVnd(order.quoted_price)}</span>
              {order.quote_expires_at && (
                <span className="text-xs text-muted-foreground"> · hiệu lực đến {when(order.quote_expires_at)}</span>
              )}
            </p>
            {order.quote_note && <p className="text-xs text-muted-foreground">{order.quote_note}</p>}
            {expired && <p className="text-xs text-destructive">Báo giá đã hết hạn — liên hệ sàn để được báo giá lại.</p>}
          </div>
        )}

        {order.status === "paid" && order.method === "from_photos" && (
          <p>Đã thanh toán — đối tác sẽ giám định dựa trên ảnh & video trong hồ sơ.</p>
        )}
        {order.status === "paid" && order.method === "on_site" && (
          <p>Đã thanh toán — sàn sẽ liên hệ để hẹn lịch chuyên gia tới xem hiện vật.</p>
        )}
        {(order.status === "paid" || order.status === "item_pending") && order.method === "ship_item" && (
          <ShipmentForm order={order} editable={owner} />
        )}
        {order.status === "item_pending" && order.method === "on_site" && (
          <p className="flex items-start gap-1.5">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Lịch giám định: <span className="font-semibold">{when(order.appointment_at)}</span>
              {order.appointment_note && <span className="block text-xs text-muted-foreground">{order.appointment_note}</span>}
            </span>
          </p>
        )}
        {order.status === "in_review" && <p>Đối tác đang giám định — chứng thư sẽ hiển thị tại đây khi có kết quả.</p>}
      </div>

      {owner && (
        <div className="flex flex-wrap gap-2">
          {order.status === "quoted" && !expired && (isRequester ? (
            <ServiceContractPayButton kind="giam-dinh" orderId={order.id} price={order.quoted_price} />
          ) : (
            <p className="text-xs text-muted-foreground">Chờ người gửi yêu cầu thanh toán.</p>
          ))}
          {(order.status === "requested" || order.status === "quoted") && (
            <Button
              size="sm"
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ orderId: order.id, postingId: order.asset_posting_id })}
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Huỷ yêu cầu
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ShipmentForm({ order, editable }: { order: AuthenticationOrder; editable: boolean }) {
  const submit = useSubmitAuthenticationShipment();
  const [tracking, setTracking] = useState(order.shipment_tracking ?? "");

  if (!editable) {
    return order.shipment_tracking ? (
      <p className="flex items-center gap-1.5">
        <Truck className="h-4 w-4 text-primary" /> Mã vận đơn: <span className="font-mono">{order.shipment_tracking}</span>
      </p>
    ) : (
      <p>Chờ người bán gửi hiện vật.</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-start gap-1.5">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        {order.shipment_tracking
          ? "Đã ghi nhận mã vận đơn — đối tác sẽ xác nhận khi nhận hiện vật. Sửa lại được nếu nhập nhầm."
          : "Đã thanh toán — đóng gói và gửi hiện vật tới đối tác theo hướng dẫn sàn gửi, rồi nhập mã vận đơn."}
      </p>
      <Label htmlFor={`gd-tracking-${order.id}`}>
        Mã vận đơn <span className="text-destructive">*</span>
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={`gd-tracking-${order.id}`}
          value={tracking}
          maxLength={200}
          placeholder="Mã vận đơn (VD: VNPOST, GHN…)"
          onChange={(e) => setTracking(e.target.value)}
          className="sm:max-w-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={tracking.trim().length < 4 || tracking.trim() === order.shipment_tracking || submit.isPending}
          onClick={() => submit.mutate({ orderId: order.id, postingId: order.asset_posting_id, tracking: tracking.trim() })}
        >
          <Truck className="mr-1.5 h-3.5 w-3.5" /> Lưu mã vận đơn
        </Button>
      </div>
    </div>
  );
}
