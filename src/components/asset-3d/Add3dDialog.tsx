import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Loader2,
  Smartphone,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/hooks/useCredits";
import { Asset3dRpcError, summarizeScans, usePostingScans, useStartScan } from "@/hooks/useAsset3dScans";
import { getVariantCost } from "@/lib/serviceCatalog";
import { buildScanDeeplink, SCAN_EXPIRY_HOURS, SCAN_PARTNER_NAME, SCAN_STEPS } from "@/lib/scan3d/partner";
import type { StartedScan } from "@/types/asset3d";

interface Add3dDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Trả về id hồ sơ để gắn model — trong wizard, hàm này tự lưu nháp nếu hồ sơ
   * chưa có trong DB. null = chưa lưu được (hàm tự báo lỗi).
   */
  resolvePostingId: () => Promise<string | null>;
  /** Mở thẳng bước quét của một phiên đang chạy (không qua xác nhận, không trừ credit). */
  resumeScan?: StartedScan | null;
}

type Step = "method" | "confirm" | "scan";

/** Luồng "Thêm 3D": chọn cách → xác nhận trừ credit → mở app đối tác & chờ kết quả. */
export function Add3dDialog({ open, onOpenChange, resolvePostingId, resumeScan }: Add3dDialogProps) {
  const [step, setStep] = useState<Step>("method");
  const [started, setStarted] = useState<StartedScan | null>(null);

  useEffect(() => {
    if (open && resumeScan) {
      setStarted(resumeScan);
      setStep("scan");
    }
  }, [open, resumeScan]);
  const [preparing, setPreparing] = useState(false);
  const [insufficient, setInsufficient] = useState(false);

  const { balance } = useCredits();
  const start = useStartScan();
  const { data: cost = 0 } = useQuery({
    queryKey: ["variant-cost", "scan_3d_owner"],
    queryFn: () => getVariantCost("scan_3d_owner"),
    enabled: open,
  });

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setStep("method");
      setStarted(null);
      setInsufficient(false);
    }
  };

  const confirm = async () => {
    setPreparing(true);
    setInsufficient(false);
    try {
      const postingId = await resolvePostingId();
      if (!postingId) return;
      const scan = await start.mutateAsync({ postingId });
      setStarted(scan);
      setStep("scan");
      if (scan.reused) toast.info("Hồ sơ đang có một phiên quét chưa xong — tiếp tục phiên đó, không trừ thêm credit.");
      else if (scan.cost > 0) toast.success(`Đã trừ ${scan.cost} credit cho lượt quét 3D.`);
    } catch (err) {
      if (err instanceof Asset3dRpcError && err.reason === "insufficient") setInsufficient(true);
      else toast.error(err instanceof Error ? err.message : "Không bắt đầu được phiên quét.");
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm model 3D</DialogTitle>
          <DialogDescription>
            Model 3D thể hiện đầy đủ bề mặt, vết nứt và chi tiết mà ảnh phẳng khó cho thấy.
          </DialogDescription>
        </DialogHeader>

        {step === "method" && (
          <div className="grid gap-3">
            <MethodOption
              icon={<Smartphone className="h-5 w-5" />}
              title="Tự quét bằng điện thoại"
              desc="Dùng ứng dụng của đối tác quét quanh tài sản. Model tự gắn vào hồ sơ khi xử lý xong."
              onClick={() => setStep("confirm")}
            />
            <MethodOption
              icon={<Users className="h-5 w-5" />}
              title="Đối tác đến quét tại chỗ"
              desc="Kỹ thuật viên mang thiết bị chuyên dụng đến nơi đặt tài sản."
              disabled
            />
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
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
              <Button variant="ghost" onClick={() => setStep("method")} disabled={preparing}>
                Quay lại
              </Button>
              <Button onClick={confirm} disabled={preparing}>
                {preparing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận & bắt đầu quét
              </Button>
            </div>
          </div>
        )}

        {step === "scan" && started && <ScanStep scan={started} onClose={() => close(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function MethodOption({
  icon,
  title,
  desc,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-semibold text-foreground">
          {title}
          {disabled && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Sắp có</span>}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

/** Mở app đối tác + theo dõi trạng thái phiên quét (hỏi lại 15 s/lần khi đang chạy). */
function ScanStep({ scan, onClose }: { scan: StartedScan; onClose: () => void }) {
  const { data: scans = [] } = usePostingScans(scan.lotId);
  const mine = scans.find((s) => s.id === scan.scanId);
  const { current } = summarizeScans(scans);
  const link = buildScanDeeplink({ scanId: scan.scanId, lotId: scan.lotId, token: scan.scanToken });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Đã sao chép liên kết quét — mở trên điện thoại để quét.");
    } catch {
      toast.error("Không sao chép được liên kết.");
    }
  };

  if (mine?.status === "ready" && current?.id === mine.id) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <div>
          <p className="font-semibold text-foreground">Model 3D đã gắn vào hồ sơ</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Model chỉ hiển thị công khai sau khi hồ sơ được sàn duyệt.
          </p>
        </div>
        <Button onClick={onClose}>Xong</Button>
      </div>
    );
  }

  if (mine && (mine.status === "failed" || mine.status === "expired")) {
    return (
      <div className="space-y-4 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <div>
          <p className="font-semibold text-foreground">Quét không thành công</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {mine.error_message ?? "Đối tác không trả được model."}
            {mine.refunded_at && ` Đã hoàn ${mine.credit_cost} credit.`}
          </p>
        </div>
        <Button onClick={onClose}>Đóng</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-sm">
        {SCAN_STEPS.map((text, i) => (
          <li key={text} className="flex gap-2.5">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="text-foreground">{text}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => window.open(link, "_blank", "noopener")}>
          <Smartphone className="mr-2 h-4 w-4" /> Mở ứng dụng quét
        </Button>
        <Button variant="outline" onClick={copy}>
          <Copy className="mr-2 h-4 w-4" /> Sao chép liên kết
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{SCAN_PARTNER_NAME}. Đang dùng máy tính? Gửi liên kết sang điện thoại để quét.</p>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
        {mine?.status === "processing" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-foreground">Đối tác đang dựng model 3D — thường trong vòng 10 phút.</span>
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Đang chờ kết quả quét. Bạn có thể đóng cửa sổ — model tự gắn vào hồ sơ.</span>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          <Check className="mr-2 h-4 w-4" /> Đóng, tiếp tục điền hồ sơ
        </Button>
      </div>
    </div>
  );
}
