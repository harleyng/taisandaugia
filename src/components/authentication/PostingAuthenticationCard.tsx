import { useState } from "react";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { BadgeCheck, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePostingAuthenticationOrders } from "@/hooks/useAuthenticationOrders";
import { summarizeGdOrders } from "@/lib/authentication/status";
import { REQUIRED_REASON_LABELS } from "@/lib/authentication/requirement";
import type { AuthenticationRequiredReason } from "@/types/authentication";
import { ActiveAuthenticationOrder } from "./ActiveAuthenticationOrder";
import { AuthenticationResult } from "./AuthenticationResult";
import { OrderAuthenticationDialog } from "./OrderAuthenticationDialog";
import { ServiceBanner, ServiceBannerButton } from "@/components/asset-posting/ServiceBanner";

interface PostingAuthenticationCardProps {
  /** null khi hồ sơ trong wizard chưa từng được lưu. */
  postingId: string | null;
  reviewStatus?: string | null;
  /** owner: đặt / thanh toán / gửi hiện vật · admin: xem tiến trình + kết luận. */
  mode: "owner" | "admin";
  /** Wizard truyền hàm tự lưu nháp; mặc định dùng postingId sẵn có. */
  resolvePostingId?: () => Promise<string | null>;
  /** Hồ sơ đã kết thúc (huỷ / đã ký hợp đồng) ⇒ không đặt đơn mới. */
  locked?: boolean;
  /** Lý do bắt buộc giám định (BR-GD-03), rỗng = tuỳ chọn. */
  requiredReasons?: AuthenticationRequiredReason[];
  /** Lý do admin ghi khi đánh dấu lô bắt buộc. */
  lotReason?: string | null;
  /** "banner": banner gọn trong khối "Thẩm định" ở bước 4 của wizard số hoá. */
  variant?: "card" | "banner";
}

/** Khối "Giám định" của một hồ sơ số hoá — bắt buộc?, đơn đang chạy, kết luận hiện hành. */
export function PostingAuthenticationCard({
  postingId,
  reviewStatus,
  mode,
  resolvePostingId,
  locked,
  requiredReasons = [],
  lotReason,
  variant = "card",
}: PostingAuthenticationCardProps) {
  const [open, setOpen] = useState(false);
  // Người xem / Cán bộ ngoài phạm vi chi nhánh chỉ xem.
  const canWrite = usePostingCanWrite();
  const { data: orders = [], isLoading } = usePostingAuthenticationOrders(postingId);
  const { active, completed } = summarizeGdOrders(orders);
  const resolve = resolvePostingId ?? (async () => postingId);
  const approved = reviewStatus === "approved";
  const loading = !!postingId && isLoading;
  const authentic = completed?.verdict === "authentic";
  const required = requiredReasons.length > 0;

  const canOrder = mode === "owner" && canWrite && !loading && !active && !locked;
  const dialog = mode === "owner" && canWrite && (
    <OrderAuthenticationDialog open={open} onOpenChange={setOpen} resolvePostingId={resolve} />
  );
  const requiredNotice = required && !authentic && (
    <RequiredNotice reasons={requiredReasons} lotReason={lotReason} />
  );

  if (variant === "banner") {
    return (
      <>
        <ServiceBanner
          icon={<BadgeCheck />}
          title="Giám định qua sàn"
          desc="Chứng thư giám định độc lập của đối tác sàn giúp tăng mức xác minh của lô"
          badge={
            required && !authentic ? (
              <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold text-warning">Bắt buộc</span>
            ) : null
          }
          status={active ? { text: "Đã gửi yêu cầu", tone: "warn" } : completed ? { text: "Đã có kết luận giám định", tone: "ok" } : null}
          action={
            canOrder && (
              <ServiceBannerButton onClick={() => setOpen(true)} quiet={!!completed}>
                {completed ? "Giám định lại" : "Yêu cầu thẩm định"}
              </ServiceBannerButton>
            )
          }
        >
          {(requiredNotice || active || completed) && (
            <>
              {requiredNotice}
              {completed && <AuthenticationResult order={completed} approved={approved} mode={mode} />}
              {active && <ActiveAuthenticationOrder order={active} mode={mode} />}
              {required && !authentic && (
                <p className="text-xs text-muted-foreground">
                  Giám định cần vài ngày làm việc. Bạn có thể “Lưu & thoát” và nộp hồ sơ khi đã có chứng thư.
                </p>
              )}
            </>
          )}
        </ServiceBanner>
        {dialog}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {requiredNotice}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải giám định…
        </div>
      ) : completed ? (
        <AuthenticationResult order={completed} approved={approved} mode={mode} />
      ) : (
        !active && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-input bg-background p-4">
            <BadgeCheck className="h-8 w-8 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {mode === "owner"
                ? "Chưa giám định. Cổ vật, tranh, trang sức có chứng thư của đơn vị giám định độc lập được người mua tin tưởng và trả giá cao hơn."
                : "Hồ sơ chưa giám định."}
            </p>
          </div>
        )
      )}

      {active && <ActiveAuthenticationOrder order={active} mode={mode} />}

      {canOrder && (
        <Button
          type="button"
          variant={completed ? "outline" : "default"}
          size="sm"
          onClick={() => setOpen(true)}
        >
          <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
          {completed ? "Giám định lại" : "Đặt giám định"}
        </Button>
      )}

      {dialog}
    </div>
  );
}

function RequiredNotice({ reasons, lotReason }: { reasons: AuthenticationRequiredReason[]; lotReason?: string | null }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div className="space-y-0.5">
        <p className="font-semibold">Bắt buộc có chứng thư giám định trước khi nộp hồ sơ</p>
        <ul className="text-xs text-muted-foreground">
          {reasons.map((r) => (
            <li key={r}>
              • {REQUIRED_REASON_LABELS[r]}
              {r === "lot_flag" && lotReason ? `: ${lotReason}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
