import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Coins } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { CREDIT_PACKAGES, useCredits } from "@/hooks/useCredits";
import { unlockAsset, unlockCompany, CompanyTierKey } from "@/lib/mockCredits";

const PaymentResult = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { balance } = useCredits();
  const status = params.get("status");
  const packageKey = params.get("package");
  const returnPath = params.get("return");
  const unlockParam = params.get("unlock");
  const ranRef = useRef(false);
  const [autoUnlocked, setAutoUnlocked] = useState<string | null>(null);

  const pkg = CREDIT_PACKAGES.find((p) => p.key === packageKey);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (status === "success" && unlockParam) {
      const [type, id, tier] = unlockParam.split(":");
      if (type === "asset" && id) {
        const r = unlockAsset(id);
        if (r.ok) setAutoUnlocked("asset");
      } else if (type === "company" && id && tier) {
        const r = unlockCompany(id, tier as CompanyTierKey);
        if (r.ok) setAutoUnlocked("company");
      }
    }
  }, [status, unlockParam]);

  const handleContinue = () => {
    if (returnPath) navigate(returnPath);
    else navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="container px-4 py-10 flex-1">
        <div className="max-w-md mx-auto">
          <Card className="p-6 md:p-8 text-center">
            {status === "success" ? (
              <>
                <div className="mx-auto h-16 w-16 rounded-full bg-[hsl(142,60%,40%)]/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-9 w-9 text-[hsl(142,60%,40%)]" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Thanh toán thành công</h1>
                {pkg && (
                  <p className="text-sm text-muted-foreground inline-flex items-center gap-1 justify-center">
                    <Coins className="h-4 w-4 text-primary" />
                    +{pkg.credits} credit đã được cộng vào tài khoản
                  </p>
                )}
                <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                  Số dư: <span className="font-semibold text-foreground">{balance} credit</span>
                </div>
                {autoUnlocked === "asset" && (
                  <p className="mt-4 text-sm text-foreground bg-primary/10 rounded-lg px-3 py-2">
                    ✅ Đã tự động mở khóa tài sản
                  </p>
                )}
                {autoUnlocked === "company" && (
                  <p className="mt-4 text-sm text-foreground bg-primary/10 rounded-lg px-3 py-2">
                    ✅ Đã tự động mở khóa hồ sơ đơn vị
                  </p>
                )}
                <Button onClick={handleContinue} size="lg" className="w-full mt-6">
                  {returnPath ? "Tiếp tục" : "Quay về trang chủ"}
                </Button>
                {returnPath && (
                  <Button onClick={() => navigate("/")} size="lg" variant="outline" className="w-full mt-2">
                    Quay về trang chủ
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <XCircle className="h-9 w-9 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Thanh toán thất bại</h1>
                <p className="text-sm text-muted-foreground">Giao dịch không thành công. Vui lòng thử lại.</p>
                <Button onClick={() => navigate(-1)} size="lg" className="w-full mt-6">
                  Thử lại
                </Button>
              </>
            )}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentResult;
