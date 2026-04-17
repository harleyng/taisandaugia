import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Check, Loader2, ShieldCheck, ChevronRight } from "lucide-react";
import { CREDIT_PACKAGES, useCredits } from "@/hooks/useCredits";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addCredits as addCreditsImpl } from "@/lib/mockCredits";
import packStarter from "@/assets/credits/pack-starter.jpg";
import packPopular from "@/assets/credits/pack-popular.jpg";
import packValue from "@/assets/credits/pack-value.jpg";
import packPro from "@/assets/credits/pack-pro.jpg";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const IMAGES: Record<string, string> = {
  starter: packStarter,
  popular: packPopular,
  value: packValue,
  pro: packPro,
};

const formatVnd = (n: number) => `${(n / 1000).toLocaleString("vi-VN")}k`;

const BuyCredits = () => {
  const { balance } = useCredits();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [paying, setPaying] = useState<string | null>(null);
  const [showVnpay, setShowVnpay] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const returnPath = params.get("return") || "";
  const unlockParam = params.get("unlock") || "";

  const handleBuy = (key: string) => {
    setPendingKey(key);
    setShowVnpay(true);
  };

  const confirmVnpayPay = () => {
    if (!pendingKey) return;
    setShowVnpay(false);
    setPaying(pendingKey);
    const pkg = CREDIT_PACKAGES.find((p) => p.key === pendingKey)!;
    setTimeout(() => {
      addCreditsImpl(pkg.credits, pkg.key, pkg.priceVnd);
      const sp = new URLSearchParams();
      sp.set("status", "success");
      sp.set("package", pkg.key);
      if (returnPath) sp.set("return", returnPath);
      if (unlockParam) sp.set("unlock", unlockParam);
      navigate(`/payment-result?${sp.toString()}`);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="container px-4 py-6 md:py-10 flex-1">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Mua credit</h1>
            <p className="text-sm text-muted-foreground">
              Số dư hiện tại:{" "}
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Coins className="h-4 w-4 text-primary" />
                {balance} credit
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKAGES.map((pkg) => {
              const isPopular = pkg.popular;
              const isPaying = paying === pkg.key;
              return (
                <Card
                  key={pkg.key}
                  className={cn(
                    "relative p-5 flex flex-col items-center text-center transition-all",
                    isPopular ? "border-2 border-primary shadow-lg" : "border-border"
                  )}
                >
                  {isPopular && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Phổ biến
                    </Badge>
                  )}
                  <div className="w-32 h-32 mb-3 flex items-center justify-center">
                    <img
                      src={IMAGES[pkg.key]}
                      alt={`Gói ${pkg.name}`}
                      loading="lazy"
                      width={128}
                      height={128}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{pkg.name}</h3>
                  <p className="text-2xl font-extrabold text-foreground mt-1">{formatVnd(pkg.priceVnd)}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    {pkg.credits} credit
                  </p>
                  <Button
                    className="w-full mt-4"
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => handleBuy(pkg.key)}
                    disabled={!!paying}
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        Mua ngay
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-1.5 w-full">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Thanh toán an toàn qua VNPay (mô phỏng)
          </div>
        </div>
      </main>
      <Footer />

      {/* VNPay mock dialog */}
      <Dialog open={showVnpay} onOpenChange={(o) => !paying && setShowVnpay(o)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[hsl(217,91%,40%)] to-[hsl(217,91%,55%)] text-white p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-lg tracking-wide">VNPAY</div>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-xs opacity-90 mt-1">Cổng thanh toán điện tử</p>
          </div>
          <div className="p-5 space-y-4">
            {pendingKey && (() => {
              const pkg = CREDIT_PACKAGES.find((p) => p.key === pendingKey)!;
              return (
                <>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sản phẩm</span>
                      <span className="font-medium text-foreground">Gói {pkg.name} ({pkg.credits} credit)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Số tiền</span>
                      <span className="font-bold text-foreground">{pkg.priceVnd.toLocaleString("vi-VN")} ₫</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phương thức</span>
                      <span className="font-medium text-foreground">Thẻ ATM / QR</span>
                    </div>
                  </div>
                  <Button onClick={confirmVnpayPay} className="w-full" size="lg">
                    {paying ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Đang xử lý...</> : "Thanh toán"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Đây là môi trường mô phỏng — không có giao dịch thật.
                  </p>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuyCredits;
