import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, QrCode, Landmark, CreditCard, Smartphone, ShieldCheck, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CREDIT_PACKAGES } from "@/hooks/useCredits";
import { addCredits as addCreditsImpl } from "@/lib/mockCredits";
import { cn } from "@/lib/utils";

type Method = "qr" | "atm" | "intl" | "app";

const METHODS: { key: Method; title: string; icon: typeof QrCode; sub?: string }[] = [
  { key: "qr", title: "App Ngân hàng và Ví điện tử (VNPAYQR)", icon: QrCode },
  { key: "atm", title: "Thẻ nội địa và tài khoản ngân hàng", icon: Landmark },
  { key: "intl", title: "Thẻ thanh toán quốc tế", icon: CreditCard, sub: "VISA · Mastercard · JCB · UnionPay · AMEX" },
  { key: "app", title: "App VNPAY", icon: Smartphone },
];

const formatVnd = (n: number) => `${n.toLocaleString("vi-VN")}`;

const buildQrDataUrl = (text: string) => {
  // Use external QR generator (no extra dep). Renders a fake-looking QR.
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data=${encoded}`;
};

const VnpayCheckout = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const packageKey = params.get("package") || "";
  const returnPath = params.get("return") || "";
  const unlockParam = params.get("unlock") || "";

  const pkg = useMemo(() => CREDIT_PACKAGES.find((p) => p.key === packageKey), [packageKey]);

  const [step, setStep] = useState<"method" | "qr">("method");
  const [method, setMethod] = useState<Method>("qr");
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const orderId = useMemo(() => Math.floor(100000 + Math.random() * 900000).toString(), []);

  useEffect(() => {
    if (!pkg) navigate("/profile?tab=credits", { replace: true });
  }, [pkg, navigate]);

  useEffect(() => {
    if (step !== "qr") return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [step]);

  if (!pkg) return null;

  const goToResult = (status: "success" | "failed") => {
    if (status === "success") {
      addCreditsImpl(pkg.credits, pkg.key, pkg.priceVnd);
    }
    const sp = new URLSearchParams();
    sp.set("status", status);
    sp.set("package", pkg.key);
    if (returnPath) sp.set("return", returnPath);
    if (unlockParam) sp.set("unlock", unlockParam);
    navigate(`/payment-result?${sp.toString()}`);
  };

  const handleBack = () => {
    if (step === "qr") setStep("method");
    else navigate(-1);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const qrPayload = `vnpay://pay?order=${orderId}&amount=${pkg.priceVnd}&pkg=${pkg.key}`;

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      {/* Top bar */}
      <div className="container px-4 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:opacity-80"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
            <ArrowLeft className="h-4 w-4" />
          </span>
          Quay lại
        </button>
        <div className="inline-flex items-center gap-1.5 text-sm">
          <span className="inline-flex h-5 w-7 rounded-sm overflow-hidden border border-border">
            <span className="flex-1 bg-[#da251d] flex items-center justify-center text-[10px] text-yellow-300">★</span>
          </span>
          <span className="text-muted-foreground">Vi</span>
        </div>
      </div>

      <main className="container px-4 pb-10 max-w-5xl mx-auto">
        <Card className="overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border bg-white">
            <div className="flex items-center gap-3">
              <div className="font-extrabold text-2xl tracking-tight">
                <span className="text-[#005baa]">VN</span>
                <span className="text-[#da251d]">PAY</span>
                <sup className="text-[10px] text-[#da251d]">QR</sup>
              </div>
              <div className="hidden sm:block text-[10px] text-muted-foreground leading-tight">
                CỔNG THANH TOÁN<br />ĐIỆN TỬ
              </div>
            </div>
            <div className="flex items-center gap-4">
              {step === "qr" && (
                <div className="hidden md:flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Giao dịch hết hạn sau</span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <span className="bg-foreground text-background px-2 py-0.5 rounded">{mm}</span>
                    <span>:</span>
                    <span className="bg-foreground text-background px-2 py-0.5 rounded">{ss}</span>
                  </span>
                </div>
              )}
              <div className="font-extrabold text-xl">
                <span className="text-[#005baa]">V</span>
                <span className="text-[#da251d]">3</span>
                <span className="text-[#005baa]">an</span>
                <span className="text-[10px] text-muted-foreground">.vn</span>
              </div>
            </div>
          </div>

          {step === "method" && (
            <div className="p-5 sm:p-8 bg-[#f9fafb]">
              <h1 className="text-xl sm:text-2xl font-bold text-center text-foreground mb-6">
                Chọn phương thức thanh toán <span className="text-muted-foreground font-normal">(Test)</span>
              </h1>

              <div className="space-y-3 max-w-2xl mx-auto">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = method === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setMethod(m.key)}
                      className={cn(
                        "w-full flex items-center justify-between gap-4 rounded-lg border bg-white px-4 py-4 text-left transition-all hover:shadow-sm",
                        active ? "border-[#005baa] ring-2 ring-[#005baa]/20" : "border-border",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm sm:text-base">{m.title}</p>
                        {m.sub && <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>}
                      </div>
                      <div className="shrink-0 h-12 w-12 rounded-md bg-muted/50 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-[#005baa]" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="max-w-2xl mx-auto mt-6">
                <Button
                  size="lg"
                  className="w-full bg-[#005baa] hover:bg-[#004a8c] text-white"
                  onClick={() => setStep("qr")}
                >
                  Tiếp tục
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === "qr" && (
            <div className="p-5 sm:p-8 bg-white">
              {/* Mobile expiry */}
              <div className="md:hidden flex items-center justify-end gap-2 text-sm mb-3">
                <span className="text-muted-foreground">Hết hạn sau</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <span className="bg-foreground text-background px-2 py-0.5 rounded">{mm}</span>
                  <span>:</span>
                  <span className="bg-foreground text-background px-2 py-0.5 rounded">{ss}</span>
                </span>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex gap-2 text-sm text-amber-900 mb-6">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Quý khách vui lòng không tắt trình duyệt cho đến khi nhận được kết quả giao dịch trên website.
                  Đây là môi trường <strong>mô phỏng</strong> — không có giao dịch thật.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Order info */}
                <div className="bg-[#f9fafb] rounded-lg p-5">
                  <h2 className="text-lg font-bold text-foreground mb-4">
                    Thông tin đơn hàng <span className="text-muted-foreground font-normal text-sm">(Test)</span>
                  </h2>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Số tiền thanh toán</p>
                      <p className="text-2xl font-bold text-[#005baa]">
                        {formatVnd(pkg.priceVnd)}
                        <sup className="text-xs ml-0.5">VND</sup>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sản phẩm</p>
                      <p className="font-semibold text-foreground">Gói {pkg.name} — {pkg.credits} credit</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phí giao dịch</p>
                      <p className="font-semibold text-foreground">0<sup className="text-xs ml-0.5">VND</sup></p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mã đơn hàng</p>
                      <p className="font-semibold text-foreground">{orderId}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nhà cung cấp</p>
                      <p className="font-semibold text-foreground">MC CTT VNPAY</p>
                    </div>
                  </div>
                </div>

                {/* QR */}
                <div className="flex flex-col items-center text-center">
                  <h2 className="text-lg font-bold text-foreground">
                    {method === "qr" || method === "app"
                      ? "Quét mã qua App Ngân hàng/Ví điện tử"
                      : "Hoàn tất thanh toán"}
                  </h2>
                  <button className="mt-2 inline-flex items-center gap-1 text-sm text-[#005baa] hover:underline">
                    <Info className="h-4 w-4" />
                    Hướng dẫn thanh toán
                  </button>
                  <div className="mt-4 p-3 border-2 border-[#005baa] rounded-lg bg-white">
                    <img
                      src={buildQrDataUrl(qrPayload)}
                      alt="QR thanh toán VNPay (mô phỏng)"
                      width={240}
                      height={240}
                      className="block"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Scan to Pay</p>

                  <div className="w-full max-w-xs space-y-2 mt-4">
                    <Button
                      size="lg"
                      className="w-full bg-[#005baa] hover:bg-[#004a8c] text-white"
                      onClick={() => goToResult("success")}
                    >
                      Mô phỏng thanh toán thành công
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full"
                      onClick={() => goToResult("failed")}
                    >
                      Hủy thanh toán
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-border bg-white text-sm">
            <a href="mailto:hotrovnpay@vnpay.vn" className="text-[#005baa] hover:underline">
              hotrovnpay@vnpay.vn
            </a>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Secure · PCI DSS Compliant
            </div>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Phát triển bởi VNPAY © {new Date().getFullYear()}
        </p>
      </main>
    </div>
  );
};

export default VnpayCheckout;
