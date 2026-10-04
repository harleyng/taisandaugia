import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { ServiceContractPayButton } from "@/components/service-contracts/ServiceContractPayButton";
import { useCancelValuation } from "@/hooks/useValuationOrders";
import { formatVnd } from "@/lib/advertising/slug";
import { ADMIN_VALUATION_PATH } from "@/lib/valuation/paths";
import { isTdgQuoteExpired, purposeLabel } from "@/lib/valuation/status";
import type { ValuationOrder } from "@/types/valuation";
import { ValuationStatusStepper } from "./ValuationStatusStepper";

const when = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm, dd/MM/yyyy", { locale: vi }) : "—");

/** Đơn thẩm định giá đang chạy: tiến trình + việc người bán cần làm (thanh toán / huỷ). */
export function ActiveValuationOrder({ row, mode }: { row: ValuationOrder; mode: "owner" | "admin" }) {
  const navigate = useNavigate();
  const cancel = useCancelValuation();
  const expired = isTdgQuoteExpired(row);
  const { userId } = useAuth();
  // Người xem / Cán bộ ngoài phạm vi chỉ đọc; chỉ NGƯỜI GỬI yêu cầu thanh toán (_settle_* kiểm user_id).
  const canWrite = usePostingCanWrite();
  const owner = mode === "owner" && canWrite;
  const isRequester = row.user_id === userId;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Đơn <span className="font-mono font-semibold text-foreground">{row.code}</span> · {purposeLabel(row.purpose)}
          {row.expert_name && (
            <>
              {" "}
              · Thẩm định viên {row.expert_name} ({row.partner_name})
            </>
          )}
        </span>
        {mode === "admin" && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => navigate(`${ADMIN_VALUATION_PATH}/${row.id}`)}
          >
            Mở đơn <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
      <ValuationStatusStepper status={row.status} />

      <div className="space-y-1 text-sm text-foreground">
        {row.status === "requested" && <p>Sàn đang xem hồ sơ, sẽ phân công đơn vị thẩm định và gửi báo giá sớm.</p>}
        {row.status === "quoted" && (
          <>
            <p>
              Báo giá: <span className="font-semibold text-primary">{formatVnd(row.quoted_price)}</span>
              {row.quote_expires_at && (
                <span className="text-xs text-muted-foreground"> · hiệu lực đến {when(row.quote_expires_at)}</span>
              )}
            </p>
            {row.quote_note && <p className="text-xs text-muted-foreground">{row.quote_note}</p>}
            {expired && <p className="text-xs text-destructive">Báo giá đã hết hạn — liên hệ sàn để được báo giá lại.</p>}
          </>
        )}
        {row.status === "paid" && <p>Đã thanh toán — đơn vị thẩm định sẽ liên hệ hẹn lịch khảo sát.</p>}
        {row.status === "in_review" && <p>Đang thẩm định — chứng thư và giá trị sẽ hiển thị tại đây khi hoàn tất.</p>}
        {row.site_address && <p className="text-xs text-muted-foreground">Địa chỉ khảo sát: {row.site_address}</p>}
      </div>

      {owner && (
        <div className="flex flex-wrap gap-2">
          {row.status === "quoted" &&
            !expired &&
            (isRequester ? (
              <ServiceContractPayButton kind="tham-dinh" orderId={row.id} price={row.quoted_price} />
            ) : (
              <p className="text-xs text-muted-foreground">Chờ người gửi yêu cầu thanh toán.</p>
            ))}
          {(row.status === "requested" || row.status === "quoted") && (
            <Button
              size="sm"
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ orderId: row.id, postingId: row.asset_posting_id })}
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Huỷ yêu cầu
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
