import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Camera, CheckCircle2, FlaskConical, Loader2, ScanLine, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMockPartnerDeliver } from "@/hooks/useAsset3dScans";

type Phase = "intro" | "capturing" | "captured" | "sent-ready" | "sent-failed" | "error";

const CAPTURE_MS = 6_000;

/**
 * /doi-tac-3d/quet — MÔ PHỎNG ứng dụng quét 3D của đối tác (mở từ deeplink).
 *
 * Không phải màn của sàn: đứng riêng, không header/menu, gắn nhãn mô phỏng rõ ràng.
 * "Gửi kết quả" gọi mock_partner_deliver_asset_3d_scan — cùng hàm SQL mà webhook
 * thật gọi — nên model về hồ sơ theo đúng luật gắn lot_id. Khi có đối tác thật,
 * deeplink trỏ sang app của họ và trang này bị gỡ.
 */
export default function Scan3dPartnerSimulator() {
  const [params] = useSearchParams();
  const scanId = params.get("scan_ref");
  const lotId = params.get("lot_id");
  const token = params.get("token");

  const [phase, setPhase] = useState<Phase>("intro");
  const [progress, setProgress] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const deliver = useMockPartnerDeliver();
  const timer = useRef<number>();

  useEffect(() => () => window.clearInterval(timer.current), []);

  if (!scanId || !lotId || !token) {
    return (
      <Shell>
        <StatusBlock
          icon={<AlertCircle className="h-12 w-12 text-destructive" />}
          title="Liên kết quét không hợp lệ"
          text="Mở lại liên kết từ nút “Thêm 3D” trong hồ sơ tài sản."
        />
      </Shell>
    );
  }

  const send = (outcome: "ready" | "failed") => {
    setErrorText(null);
    deliver.mutate(
      { scanId, lotId, token, outcome },
      {
        onSuccess: () => setPhase(outcome === "ready" ? "sent-ready" : "sent-failed"),
        onError: (err) => {
          setErrorText(err instanceof Error ? err.message : "Không gửi được kết quả.");
          setPhase("error");
        },
      },
    );
  };

  const startCapture = () => {
    setPhase("capturing");
    setProgress(0);
    // Báo đối tác "đang xử lý" ngay khi bắt đầu — như app thật tải ảnh lên cloud.
    deliver.mutate({ scanId, lotId, token, outcome: "processing" }, { onError: () => undefined });
    const startedAt = Date.now();
    timer.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / CAPTURE_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(timer.current);
        setPhase("captured");
      }
    }, 150);
  };

  return (
    <Shell>
      {phase === "intro" && (
        <div className="space-y-5 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 text-primary">
            <ScanLine className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Quét 3D tài sản</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Đi chậm một vòng quanh tài sản. Ứng dụng tự chụp và ghép thành model 3D.
            </p>
          </div>
          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
            lot_id {lotId}
          </p>
          <Button className="w-full" size="lg" onClick={startCapture}>
            <Camera className="mr-2 h-5 w-5" /> Bắt đầu quét
          </Button>
        </div>
      )}

      {phase === "capturing" && (
        <div className="space-y-5 text-center">
          <div className="mx-auto grid h-48 w-full place-items-center rounded-2xl border-2 border-dashed border-primary/40 bg-muted">
            <Camera className="h-12 w-12 animate-pulse text-primary" />
          </div>
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">Đang chụp các góc… {Math.round(progress)}%</p>
        </div>
      )}

      {phase === "captured" && (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <div>
            <h2 className="font-semibold text-foreground">Đã chụp đủ góc</h2>
            <p className="mt-1 text-sm text-muted-foreground">Gửi lên để đối tác dựng model 3D.</p>
          </div>
          <Button className="w-full" size="lg" onClick={() => send("ready")} disabled={deliver.isPending}>
            {deliver.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
            Gửi kết quả
          </Button>
          <Button variant="outline" className="w-full" onClick={() => send("failed")} disabled={deliver.isPending}>
            <XCircle className="mr-2 h-4 w-4" /> Mô phỏng quét lỗi
          </Button>
        </div>
      )}

      {phase === "sent-ready" && (
        <StatusBlock
          icon={<CheckCircle2 className="h-12 w-12 text-success" />}
          title="Đã gửi model 3D"
          text="Model đã gắn vào hồ sơ tài sản. Quay lại cửa sổ số hoá để xem — model chỉ công khai sau khi hồ sơ được duyệt."
        />
      )}

      {phase === "sent-failed" && (
        <StatusBlock
          icon={<XCircle className="h-12 w-12 text-destructive" />}
          title="Đã báo quét lỗi"
          text="Credit của lượt quét đã được hoàn. Bạn có thể quét lại từ hồ sơ tài sản."
        />
      )}

      {phase === "error" && (
        <StatusBlock
          icon={<AlertCircle className="h-12 w-12 text-destructive" />}
          title="Không gửi được kết quả"
          text={errorText ?? "Vui lòng thử lại."}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <FlaskConical className="h-4 w-4 shrink-0 text-warning" />
          Mô phỏng ứng dụng đối tác quét 3D — dùng để thử luồng, không phải app thật.
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">{children}</div>
      </div>
    </div>
  );
}

function StatusBlock({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-center">{icon}</div>
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
