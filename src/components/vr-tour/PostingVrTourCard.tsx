import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarClock, CreditCard, ExternalLink, Eye, EyeOff, Loader2, Rotate3d, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useCancelVrTour, usePostingVrOrders } from "@/hooks/useVrTourOrders";
import { useAttachVrTour } from "@/hooks/useAdminVrTourOrders";
import { formatVnd } from "@/lib/advertising/slug";
import { isQuoteExpired, summarizeVrOrders } from "@/lib/vrTour/status";
import { ADMIN_VR_TOUR_PATH, vrTourCheckoutPath } from "@/lib/vrTour/paths";
import type { VrTourOrder } from "@/types/vrTour";
import { AddVrTourDialog } from "./AddVrTourDialog";
import { VrTourStatusStepper } from "./VrTourStatusStepper";
import { VrTourViewer } from "./VrTourViewer";

interface PostingVrTourCardProps {
  /** null khi hồ sơ trong wizard chưa từng được lưu. */
  postingId: string | null;
  title: string;
  reviewStatus?: string | null;
  /** owner: đặt / thanh toán · admin: xem + duyệt gắn vào lô. */
  mode: "owner" | "admin";
  /** Wizard truyền hàm tự lưu nháp; mặc định dùng postingId sẵn có. */
  resolvePostingId?: () => Promise<string | null>;
  /** Hồ sơ đã kết thúc (huỷ / đã ký hợp đồng) ⇒ không đặt đơn mới. */
  locked?: boolean;
}

const when = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm, dd/MM/yyyy", { locale: vi }) : "—");

/** Khối "VR tour" của một hồ sơ số hoá — đơn đang chạy, tour đang gắn, công khai hay chưa. */
export function PostingVrTourCard({ postingId, title, reviewStatus, mode, resolvePostingId, locked }: PostingVrTourCardProps) {
  const [open, setOpen] = useState(false);
  const { data: orders = [], isLoading } = usePostingVrOrders(postingId);
  const { active, attached } = summarizeVrOrders(orders);
  const resolve = resolvePostingId ?? (async () => postingId);
  const approved = reviewStatus === "approved";
  const canWrite = usePostingCanWrite();

  // Không return sớm khi đang tải: trong wizard postingId đổi null → id giữa lúc dialog mở.
  const loading = !!postingId && isLoading;

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải VR tour…
        </div>
      ) : attached ? (
        <>
          <VrTourViewer url={attached.vr_url!} title={title} />
          <VisibilityLine published={!!attached.published_at} approved={approved} />
        </>
      ) : (
        !active && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-input bg-background p-4">
            <Rotate3d className="h-8 w-8 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {mode === "owner"
                ? "Chưa có VR tour. Nhà xưởng, bất động sản và bộ sưu tập lớn nên có tour thực tế ảo để người mua đi xem không gian."
                : "Hồ sơ chưa có VR tour."}
            </p>
          </div>
        )
      )}

      {active && <ActiveOrder order={active} mode={mode} approved={approved} title={title} />}

      {mode === "owner" && canWrite && !loading && !active && !locked && (
        <Button type="button" variant={attached ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
          <Rotate3d className="mr-1.5 h-3.5 w-3.5" />
          {attached ? "Đặt chụp lại VR tour" : "Thêm VR tour"}
        </Button>
      )}

      {mode === "owner" && canWrite && <AddVrTourDialog open={open} onOpenChange={setOpen} resolvePostingId={resolve} />}
    </div>
  );
}

function ActiveOrder({
  order,
  mode,
  approved,
  title,
}: {
  order: VrTourOrder;
  mode: "owner" | "admin";
  approved: boolean;
  title: string;
}) {
  const navigate = useNavigate();
  const cancel = useCancelVrTour();
  const attach = useAttachVrTour();
  const canApprove = useHasAdminPermission("tai-san-tu-nguyen", "approve");
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
          Đơn <span className="font-mono font-semibold text-foreground">{order.code}</span> · {order.package_name} ·{" "}
          {order.partner_name}
        </span>
        {mode === "admin" && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => navigate(`${ADMIN_VR_TOUR_PATH}/${order.id}`)}
          >
            Mở đơn <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
      <VrTourStatusStepper status={order.status} />

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

        {order.status === "paid" && <p>Đã thanh toán — sàn sẽ liên hệ để hẹn lịch chụp.</p>}

        {order.status === "scheduled" && (
          <p className="flex items-start gap-1.5">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Lịch chụp: <span className="font-semibold">{when(order.appointment_at)}</span>
              {order.appointment_note && <span className="block text-xs text-muted-foreground">{order.appointment_note}</span>}
            </span>
          </p>
        )}

        {order.status === "delivered" && (
          <div className="space-y-2">
            <p>
              {approved
                ? "Đối tác đã giao VR tour — chờ sàn duyệt gắn vào lô."
                : "Đối tác đã giao VR tour — tour được gắn vào lô khi hồ sơ được duyệt."}
            </p>
            {mode === "admin" && order.vr_url && <VrTourViewer url={order.vr_url} title={title} />}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {owner && order.status === "quoted" && !expired && (isRequester ? (
          <Button size="sm" onClick={() => navigate(vrTourCheckoutPath(order.id, order.asset_posting_id))}>
            <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Thanh toán {formatVnd(order.quoted_price)}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Chờ người gửi yêu cầu thanh toán.</p>
        ))}
        {owner && (order.status === "requested" || order.status === "quoted") && (
          <Button
            size="sm"
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ orderId: order.id, postingId: order.asset_posting_id })}
          >
            <X className="mr-1.5 h-3.5 w-3.5" /> Huỷ yêu cầu
          </Button>
        )}
        {mode === "admin" && order.status === "delivered" && canApprove && (
          <Button size="sm" disabled={!approved || attach.isPending} onClick={() => attach.mutate({ orderId: order.id })}>
            {attach.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
            {approved ? "Duyệt & gắn vào lô" : "Duyệt hồ sơ trước khi gắn"}
          </Button>
        )}
      </div>
    </div>
  );
}

function VisibilityLine({ published, approved }: { published: boolean; approved: boolean }) {
  if (published) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-success">
        <Eye className="h-3.5 w-3.5" /> VR tour đang hiển thị công khai trên trang lô.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <EyeOff className="h-3.5 w-3.5" />
      {approved ? "Chưa công khai." : "Tạm ẩn — VR tour hiển thị lại khi hồ sơ được duyệt."}
    </p>
  );
}
