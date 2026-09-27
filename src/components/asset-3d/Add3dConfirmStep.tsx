import { useNavigate } from "react-router-dom";
import { AlertCircle, BadgeCheck, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coverageLabel, type Coverage } from "@/lib/ownerSubscription/coverage";
import { OWNER_SUBSCRIPTION_PATH } from "@/lib/ownerSubscription/paths";
import { SCAN_EXPIRY_HOURS } from "@/lib/scan3d/partner";

interface Props {
  cost: number;
  balance: number;
  /** Bản xem trước theo gói thuê bao của Trạm — server vẫn quyết định lúc bấm. */
  coverage: Coverage;
  insufficient: boolean;
  /** Server từ chối vì hết lượt của gói (chế độ chặn) — có thể lệch với bản xem trước. */
  quotaExhausted: boolean;
  preparing: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

/** Bước xác nhận của "Thêm 3D": gói bao (miễn phí) / hết lượt gói (chặn) / trừ credit. */
export function Add3dConfirmStep({
  cost,
  balance,
  coverage,
  insufficient,
  quotaExhausted,
  preparing,
  onBack,
  onConfirm,
}: Props) {
  const navigate = useNavigate();
  const blocked = coverage.kind === "blocked" || quotaExhausted;
  const covered = coverage.kind === "covered" && !quotaExhausted;

  return (
    <div className="space-y-4">
      {covered ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="flex items-start gap-2 font-medium text-foreground">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {coverageLabel(coverage, "scan_3d_owner")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Không trừ credit. Quét không thành công hoặc sau {SCAN_EXPIRY_HOURS} giờ chưa có kết quả thì lượt quét được trả lại cho gói.
          </p>
        </div>
      ) : blocked ? (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="space-y-2">
            <p className="text-foreground">
              {coverage.kind === "blocked" ? coverageLabel(coverage, "scan_3d_owner") : "Đã dùng hết lượt quét 3D của gói tháng này"}.
              Liên hệ quản trị để nâng hạn mức hoặc gia hạn gói.
            </p>
            <Button size="sm" variant="outline" onClick={() => navigate(OWNER_SUBSCRIPTION_PATH)}>
              Xem gói thuê bao
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
          {coverage.kind === "credits" && coverage.exhausted && (
            <p className="mb-2 text-xs font-medium text-warning">{coverageLabel(coverage, "scan_3d_owner")}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Phí quét 3D</span>
            <span className="font-semibold text-foreground">{cost} credit</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted-foreground">Số dư hiện tại</span>
            <span className="font-medium text-foreground">{balance} credit</span>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Hoàn lại đủ credit nếu quét không thành công hoặc sau {SCAN_EXPIRY_HOURS} giờ chưa có kết quả.
          </p>
        </div>
      )}

      {insufficient && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="space-y-2">
            <p className="text-foreground">Số dư không đủ để quét 3D. Hồ sơ nháp đã được lưu.</p>
            <Button size="sm" variant="outline" onClick={() => window.open("/chu-tai-san/credits", "_blank")}>
              Nạp credit (mở tab mới)
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onBack} disabled={preparing}>
          Quay lại
        </Button>
        <Button onClick={onConfirm} disabled={preparing || blocked}>
          {preparing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Xác nhận & bắt đầu quét
        </Button>
      </div>
    </div>
  );
}
