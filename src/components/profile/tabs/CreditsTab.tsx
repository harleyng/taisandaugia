import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2, ShieldCheck, ChevronRight, Star } from "lucide-react";
import { CREDIT_PACKAGES, useCredits } from "@/hooks/useCredits";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addCredits as addCreditsImpl } from "@/lib/mockCredits";
import packStarter from "@/assets/credits/pack-starter.jpg";
import packPopular from "@/assets/credits/pack-popular.jpg";
import packValue from "@/assets/credits/pack-value.jpg";
import packPro from "@/assets/credits/pack-pro.jpg";
import packMax from "@/assets/credits/pack-max.jpg";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const IMAGES: Record<string, string> = {
  starter: packStarter,
  popular: packPopular,
  value: packValue,
  pro: packPro,
  max: packMax,
};

const formatVnd = (n: number) => `${(n / 1000).toLocaleString("vi-VN")}k`;

export const CreditsTab = () => {
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
    <div>
      <Card className="p-5 md:p-6 mb-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Mua credit</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Mở khóa thông tin để hiểu rõ thị trường và đấu giá thông minh
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm">
            <span className="text-muted-foreground">Số dư</span>
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Coins className="h-4 w-4 text-primary" />
              {balance} credit
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {CREDIT_PACKAGES.map((pkg) => {
          const isPopular = pkg.popular;
          const isBest = pkg.best;
          const isPaying = paying === pkg.key;
          return (
            <Card
              key={pkg.key}
              className={cn(
                "relative p-5 flex flex-col items-center text-center transition-all",
                isBest
                  ? "border-2 border-amber-500 shadow-lg bg-gradient-to-b from-amber-50/40 to-transparent dark:from-amber-500/10"
                  : isPopular
                    ? "border-2 border-primary shadow-lg"
                    : "border-border",
              )}
            >
              {isPopular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Phổ biến
                </Badge>
              )}
              {isBest && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white hover:bg-amber-500 inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Tiết kiệm
                </Badge>
              )}
              <div className="w-28 h-28 mb-3 flex items-center justify-center">
                <img
                  src={IMAGES[pkg.key]}
                  alt={`Gói ${pkg.name}`}
                  loading="lazy"
                  width={112}
                  height={112}
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
                className={cn("w-full mt-4", isBest && "bg-amber-500 hover:bg-amber-600 text-white")}
                variant={isPopular || isBest ? "default" : "outline"}
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

      <div className="mt-6 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-1.5 w-full">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Thanh toán an toàn qua VNPay (mô phỏng)
      </div>

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
            {pendingKey &&
              (() => {
                const pkg = CREDIT_PACKAGES.find((p) => p.key === pendingKey)!;
                return (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sản phẩm</span>
                        <span className="font-medium text-foreground">
                          Gói {pkg.name} ({pkg.credits} credit)
                        </span>
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
                      {paying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Đang xử lý...
                        </>
                      ) : (
                        "Thanh toán"
                      )}
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
