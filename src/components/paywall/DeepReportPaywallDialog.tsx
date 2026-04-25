import { Coins, FileText, Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import {
  formatPeriodKindLabel,
  formatPeriodLabel,
  parsePeriod,
} from "@/lib/reportPeriods";

interface DeepReportPaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportSlug: string;
  reportLabel: string;
  periodId: string | null;
  returnPath: string;
}

export const DeepReportPaywallDialog = ({
  open,
  onOpenChange,
  reportSlug,
  reportLabel,
  periodId,
  returnPath,
}: DeepReportPaywallDialogProps) => {
  const { balance, unlockDeepReportPeriod, DEEP_REPORT_PERIOD_PRICES } = useCredits();
  const navigate = useNavigate();
  const { toast } = useToast();

  const parsed = periodId ? parsePeriod(periodId) : null;
  if (!parsed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const cost = DEEP_REPORT_PERIOD_PRICES[parsed.kind];
  const enough = balance >= cost;
  const periodLabel = formatPeriodLabel(periodId!);
  const kindLabel = formatPeriodKindLabel(parsed.kind);

  const handleUnlock = () => {
    const r = unlockDeepReportPeriod(reportSlug, periodId!, reportLabel);
    if (r.ok) {
      toast({
        title: "Đã mở khóa báo cáo",
        description: `${periodLabel} — ${reportLabel}. Đã trừ ${cost.toLocaleString("vi-VN")} credit.`,
      });
      onOpenChange(false);
    } else if (r.reason === "insufficient") {
      toast({ title: "Không đủ credit", variant: "destructive" });
    }
  };

  const handleBuy = () => {
    onOpenChange(false);
    const params = new URLSearchParams();
    params.set("tab", "credits");
    params.set("unlock", `deep:${reportSlug}:${periodId}`);
    if (returnPath) params.set("return", returnPath);
    navigate(`/profile?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            Mở khóa báo cáo chuyên sâu
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <FileText className="h-3.5 w-3.5" />
            {reportLabel}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xl font-bold text-foreground">{periodLabel}</p>
            <Badge variant="secondary">{kindLabel}</Badge>
          </div>
        </div>

        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Mở khóa vĩnh viễn</span> snapshot{" "}
              {periodLabel} — không hết hạn.
            </span>
          </li>
          {parsed.kind === "quarter" && (
            <li className="flex items-start gap-2 text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Bonus:</span> tự động mở
                3 báo cáo Tháng bên trong Quý này.
              </span>
            </li>
          )}
          {parsed.kind === "year" && (
            <li className="flex items-start gap-2 text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Bonus:</span> tự động mở
                4 Quý + 12 Tháng trong năm này.
              </span>
            </li>
          )}
        </ul>

        <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Chi phí</p>
            <p className="text-xl font-bold text-primary inline-flex items-center gap-1.5">
              <Coins className="h-5 w-5" />
              {cost.toLocaleString("vi-VN")}{" "}
              <span className="text-sm text-muted-foreground font-normal">credit</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Số dư</p>
            <p
              className={`text-base font-semibold tabular-nums ${
                enough ? "text-foreground" : "text-destructive"
              }`}
            >
              {balance.toLocaleString("vi-VN")} credit
            </p>
          </div>
        </div>

        {enough ? (
          <Button onClick={handleUnlock} size="lg" className="w-full">
            Dùng credit để mở khóa
          </Button>
        ) : (
          <Button onClick={handleBuy} size="lg" className="w-full">
            Mua thêm credit để mở khóa
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
