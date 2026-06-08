import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetOwnerClaim } from "@/types/asset-owner";
import { ManualClaimSearch } from "./ManualClaimSearch";

interface Props {
  claims: AssetOwnerClaim[];
  workspaceId: string;
  hasRun: boolean;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onConfirmAll: () => void;
  isConfirming: boolean;
  onClaimAdded: () => void;
}

export const ClaimResultList = ({
  claims, workspaceId, hasRun,
  onConfirm, onReject, onConfirmAll,
  isConfirming, onClaimAdded,
}: Props) => {
  const navigate = useNavigate();
  const [manualOpen, setManualOpen] = useState(false);

  const autoClaimed = claims.filter((c) => c.status === "auto_claimed" || c.status === "confirmed");
  const pending = claims.filter((c) => c.status === "pending_confirmation");
  const rejected = claims.filter((c) => c.status === "rejected");
  const notMatched = 0; // placeholder — unmatched count from previous match run

  if (!hasRun) {
    return (
      <Card className="rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-4">Kết quả khớp</h3>
        <div className="text-center py-8 text-muted-foreground space-y-2">
          <Clock className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-sm">Chưa có kết quả. Xác nhận đơn vị ở trên và bấm <strong>Khớp tài sản</strong>.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl p-5 space-y-5">
      <h3 className="font-semibold text-foreground">Kết quả khớp</h3>

      {/* 3 stat boxes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 text-emerald-700 p-4 text-center">
          <p className="text-3xl font-bold font-serif">{autoClaimed.length}</p>
          <p className="text-xs mt-1">Tự động claim (&gt;90%)</p>
        </div>
        <div className="rounded-xl bg-amber-50 text-amber-700 p-4 text-center">
          <p className="text-3xl font-bold font-serif">{pending.length}</p>
          <p className="text-xs mt-1">Cần xác nhận (60–90%)</p>
        </div>
        <div className="rounded-xl bg-muted text-muted-foreground p-4 text-center">
          <p className="text-3xl font-bold font-serif">{notMatched}</p>
          <p className="text-xs mt-1">Không khớp (&lt;60%)</p>
        </div>
      </div>

      {autoClaimed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          ✓ {autoClaimed.length} tài sản đã vào dashboard. Xác nhận nhóm dưới để bổ sung — mỗi xác nhận giúp hệ thống học, lần sau khớp chính xác hơn.
        </p>
      )}

      {/* Pending confirm list */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Cần xác nhận — tài sản tên lệch ({pending.length})
          </p>
          <div className="border border-border rounded-xl overflow-hidden">
            {pending.map((c, i) => {
              const title = c.asset_owner?.name ?? c.listing?.title ?? "Tài sản không rõ";
              const pct = c.confidence_score ? `${Math.round(c.confidence_score * 100)}%` : "";
              return (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    i < pending.length - 1 && "border-b border-border"
                  )}
                >
                  <span className="flex-1 min-w-0 text-sm text-foreground truncate">{title}</span>
                  <span className="text-xs font-semibold text-amber-600 flex-shrink-0">{pct}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onReject(c.id)}
                      disabled={isConfirming}
                      className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold transition-colors disabled:opacity-50"
                    >
                      Không
                    </button>
                    <button
                      onClick={() => onConfirm(c.id)}
                      disabled={isConfirming}
                      className="text-xs px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold transition-colors disabled:opacity-50"
                    >
                      Đúng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={onConfirmAll}
              disabled={isConfirming}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Xác nhận tất cả đúng
            </Button>
            <span className="text-xs text-muted-foreground">Hoặc duyệt từng cái phía trên</span>
          </div>
        </div>
      )}

      {/* Processed (confirmed + rejected) */}
      {(rejected.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Đã xử lý ({rejected.length})</p>
          <div className="border border-border rounded-xl overflow-hidden">
            {rejected.map((c, i) => {
              const title = c.asset_owner?.name ?? c.listing?.title ?? "Tài sản không rõ";
              return (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    i < rejected.length - 1 && "border-b border-border"
                  )}
                >
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">{title}</span>
                  <span className="text-[10px] text-muted-foreground">Đã từ chối</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expandable manual search */}
      <div className="pt-1 border-t border-dashed border-border">
        <button
          onClick={() => setManualOpen((o) => !o)}
          className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline"
        >
          {manualOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Thiếu tài sản? Tìm bổ sung {notMatched > 0 ? `(${notMatched} chưa khớp)` : ""}
        </button>
        <p className="text-[11px] text-muted-foreground mt-1">
          Thi hành án, cơ quan nhà nước thường có tên lệch nhiều — hãy tìm thủ công.
        </p>

        {manualOpen && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-3">
              Tìm tài sản <strong>của tổ chức bạn</strong> mà hệ thống chưa tự gán (tên quá lệch &lt;60%). Nhập địa chỉ hoặc tên listing để tìm chính xác.
            </p>
            <ManualClaimSearch workspaceId={workspaceId} onClaimed={onClaimAdded} />
          </div>
        )}
      </div>
    </Card>
  );
};
