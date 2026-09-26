import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CreditCard, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCancelLegalConsult } from "@/hooks/useLegalConsultations";
import { formatVnd } from "@/lib/advertising/slug";
import { isTvplQuoteExpired } from "@/lib/legalConsult/status";
import { ADMIN_LEGAL_CONSULT_PATH, legalConsultCheckoutPath } from "@/lib/legalConsult/paths";
import type { LegalConsultation } from "@/types/legalConsult";
import { LegalConsultStatusStepper } from "./LegalConsultStatusStepper";
import { LegalDocChips } from "./LegalDocChips";

const when = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm, dd/MM/yyyy", { locale: vi }) : "—");

/** Lần tư vấn đang chạy: tiến trình + việc người bán cần làm (thanh toán / huỷ). */
export function ActiveLegalConsult({ row, mode }: { row: LegalConsultation; mode: "owner" | "admin" }) {
  const navigate = useNavigate();
  const cancel = useCancelLegalConsult();
  const expired = isTvplQuoteExpired(row);
  const { userId } = useAuth();
  // Người xem / Cán bộ ngoài phạm vi chỉ đọc; chỉ NGƯỜI GỬI yêu cầu thanh toán (_settle_* kiểm user_id).
  const canWrite = usePostingCanWrite();
  const owner = mode === "owner" && canWrite;
  const isRequester = row.user_id === userId;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Yêu cầu <span className="font-mono font-semibold text-foreground">{row.code}</span>
          {row.expert_name && (
            <>
              {" "}
              · Chuyên gia {row.expert_name} ({row.partner_name})
            </>
          )}
        </span>
        {mode === "admin" && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => navigate(`${ADMIN_LEGAL_CONSULT_PATH}/${row.id}`)}
          >
            Mở yêu cầu <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
      <LegalConsultStatusStepper status={row.status} />

      <div className="space-y-2 text-sm text-foreground">
        {row.status === "requested" && <p>Sàn đang xem hồ sơ, sẽ phân công chuyên gia và gửi báo giá sớm.</p>}
        {row.status === "quoted" && (
          <div className="space-y-1">
            <p>
              Báo giá: <span className="font-semibold text-primary">{formatVnd(row.quoted_price)}</span>
              {row.quote_expires_at && (
                <span className="text-xs text-muted-foreground"> · hiệu lực đến {when(row.quote_expires_at)}</span>
              )}
            </p>
            {row.quote_note && <p className="text-xs text-muted-foreground">{row.quote_note}</p>}
            {expired && <p className="text-xs text-destructive">Báo giá đã hết hạn — liên hệ sàn để được báo giá lại.</p>}
          </div>
        )}
        {row.status === "paid" && <p>Đã thanh toán — chuyên gia sẽ bắt đầu rà soát hồ sơ.</p>}
        {row.status === "in_review" && <p>Chuyên gia đang rà soát — checklist kết quả sẽ hiển thị tại đây khi hoàn tất.</p>}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Hồ sơ đã nộp ({row.submitted_doc_paths.length} tệp)</p>
          <LegalDocChips paths={row.submitted_doc_paths} />
        </div>
      </div>

      {owner && (
        <div className="flex flex-wrap gap-2">
          {row.status === "quoted" && !expired && (isRequester ? (
            <Button size="sm" onClick={() => navigate(legalConsultCheckoutPath(row.id, row.asset_posting_id))}>
              <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Thanh toán {formatVnd(row.quoted_price)}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Chờ người gửi yêu cầu thanh toán.</p>
          ))}
          {(row.status === "requested" || row.status === "quoted") && (
            <Button
              size="sm"
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ consultationId: row.id, postingId: row.asset_posting_id })}
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Huỷ yêu cầu
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
