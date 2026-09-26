import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertTriangle, Eye, EyeOff, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openCertificate } from "@/hooks/useAuthenticationOrders";
import { gdMethodLabel, gdVerdictLabel, isNegativeVerdict } from "@/lib/authentication/status";
import { verificationLevel } from "@/lib/authentication/verificationLevel";
import type { AuthenticationOrder } from "@/types/authentication";
import { AuthenticatedBadge } from "./AuthenticatedBadge";
import { VerificationLevelChip } from "./VerificationLevelChip";

const day = (iso: string | null) => (iso ? format(new Date(iso), "dd/MM/yyyy", { locale: vi }) : "—");

/**
 * Kết luận hiện hành của hồ sơ. Kết luận tiêu cực là thông tin RIÊNG (BR-GD-02): chỉ chủ
 * hồ sơ và admin đọc được dòng này (RLS), trang công khai không bao giờ thấy.
 */
export function AuthenticationResult({
  order,
  approved,
  mode,
}: {
  order: AuthenticationOrder;
  approved: boolean;
  mode: "owner" | "admin";
}) {
  const negative = isNegativeVerdict(order.verdict);
  const level = verificationLevel({
    ownerKycApproved: false,
    reviewStatus: approved ? "approved" : null,
    verdict: order.verdict,
    method: order.method,
  });

  const cert = order.certificate_path && (
    <Button type="button" size="sm" variant="outline" onClick={() => openCertificate(order.certificate_path!)}>
      <FileText className="mr-1.5 h-3.5 w-3.5" /> Xem chứng thư
    </Button>
  );

  if (negative) {
    return (
      <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> Kết quả giám định: {gdVerdictLabel(order.verdict)}
        </p>
        {order.verdict_reason && <p className="text-sm text-foreground">{order.verdict_reason}</p>}
        <p className="text-xs text-muted-foreground">
          {order.partner_name} · {gdMethodLabel(order.method)} · {day(order.issued_at)}
          {order.certificate_no && ` · số ${order.certificate_no}`}
        </p>
        <p className="text-xs text-foreground">
          {mode === "owner"
            ? "Tài sản không đăng được ở nhóm Cổ vật với kết quả này. Thông tin chỉ bạn và sàn nhìn thấy."
            : "Chỉ người bán và admin thấy kết quả này. Lô không đăng được ở nhóm Cổ vật."}
          {order.posting_reverted_at && " Hồ sơ đã được trả về nháp."}
        </p>
        {cert}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-success/30 bg-success/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <AuthenticatedBadge />
        <VerificationLevelChip level={level} />
      </div>
      <p className="text-xs text-muted-foreground">
        {order.partner_name} · {gdMethodLabel(order.method)} · cấp ngày {day(order.issued_at)}
        {order.certificate_no && ` · số ${order.certificate_no}`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {cert}
        {order.published_at ? (
          <span className="flex items-center gap-1.5 text-xs text-success">
            <Eye className="h-3.5 w-3.5" /> Chứng thư hiển thị công khai trên trang lô.
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5" /> Hiển thị công khai khi hồ sơ được sàn duyệt.
          </span>
        )}
      </div>
    </div>
  );
}
