import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VnpayMethodStep, type VnpayMethod } from "@/components/payment/VnpayMethodStep";
import { VnpayQrStep } from "@/components/payment/VnpayQrStep";
import { useCheckoutItem } from "@/hooks/useCheckoutItem";

const VnpayCheckout = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const returnPath = params.get("return") || "";
  const unlockParam = params.get("unlock") || "";

  // Gói credit (?package=) hoặc hồ sơ tham gia (?contract=) — xem useCheckoutItem.
  const { loading, item, fallbackPath } = useCheckoutItem(params);

  const [step, setStep] = useState<"method" | "qr">("method");
  const [method, setMethod] = useState<VnpayMethod>("qr");
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  // Mã hiển thị cho người dùng (6 số, dễ đọc lại qua điện thoại).
  const orderId = useMemo(() => Math.floor(100000 + Math.random() * 900000).toString(), []);
  // Mã ĐỐI SOÁT gửi sang /payment-result. Phải là UUID, không dùng lại orderId
  // 6 số: 900k khả năng ⇒ theo nghịch lý ngày sinh, chỉ ~1.100 giao dịch là đã
  // có 50% xác suất trùng, và trùng nghĩa là giao dịch thật bị coi là "đã xử lý"
  // rồi bỏ qua — khách trả tiền mà không được cộng credit.
  const txnRef = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (!loading && !item) navigate(fallbackPath, { replace: true });
  }, [loading, item, fallbackPath, navigate]);

  useEffect(() => {
    if (step !== "qr") return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [step]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!item) return null;

  const goToResult = (status: "success" | "failed") => {
    // Credit cộng / hồ sơ ghi nhận DUY NHẤT tại /payment-result. Trước đây cộng
    // thêm ở đây → mỗi giao dịch bị ghi 2 dòng `purchase` và cộng credit gấp đôi.
    const sp = new URLSearchParams(item.resultParams);
    sp.set("status", status);
    // Khoá idempotent phía server dựa vào mã này (migration 20260806000070).
    sp.set("txn", txnRef);
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
            <VnpayMethodStep method={method} onMethodChange={setMethod} onContinue={() => setStep("qr")} />
          )}

          {step === "qr" && (
            <VnpayQrStep item={item} orderId={orderId} method={method} mm={mm} ss={ss} onResult={goToResult} />
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
