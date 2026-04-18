import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  Loader2,
  ShieldCheck,
  ChevronRight,
  Star,
  Receipt,
  ShoppingCart,
  Unlock,
  Building2,
} from "lucide-react";
import { CREDIT_PACKAGES, useCredits } from "@/hooks/useCredits";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { addCredits as addCreditsImpl, getInvoiceInfo, saveInvoiceInfo, type InvoiceInfo, type Transaction, type TransactionType } from "@/lib/mockCredits";
import packStarter from "@/assets/credits/pack-starter.jpg";
import packPopular from "@/assets/credits/pack-popular.jpg";
import packValue from "@/assets/credits/pack-value.jpg";
import packPro from "@/assets/credits/pack-pro.jpg";
import packMax from "@/assets/credits/pack-max.jpg";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const IMAGES: Record<string, string> = {
  starter: packStarter,
  popular: packPopular,
  value: packValue,
  pro: packPro,
  max: packMax,
};

const formatVnd = (n: number) => `${(n / 1000).toLocaleString("vi-VN")}k`;

const dateTimeFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formatDateTime = (at: number) => dateTimeFmt.format(new Date(at));

const TYPE_ICON: Record<TransactionType, typeof ShoppingCart> = {
  purchase: ShoppingCart,
  unlock_asset: Unlock,
  unlock_company: Building2,
};

const TransactionRow = ({ tx }: { tx: Transaction }) => {
  const Icon = TYPE_ICON[tx.type];
  const isPositive = tx.creditDelta > 0;
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
        {formatDateTime(tx.at)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0",
              isPositive ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium">{tx.description}</span>
        </div>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <span
          className={cn(
            "inline-flex items-center gap-1 font-semibold",
            isPositive ? "text-green-600 dark:text-green-400" : "text-destructive",
          )}
        >
          <Coins className="h-3.5 w-3.5" />
          {isPositive ? "+" : "−"}
          {Math.abs(tx.creditDelta)}
        </span>
      </TableCell>
    </TableRow>
  );
};

export const CreditsTab = () => {
  const { balance, transactions } = useCredits();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [paying, setPaying] = useState<string | null>(null);
  const [showVnpay, setShowVnpay] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string>("");
  const [wantInvoice, setWantInvoice] = useState(false);
  const [hasSavedInvoice, setHasSavedInvoice] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceInfo>({
    companyName: "",
    taxCode: "",
    address: "",
    email: "",
  });
  const [invoiceErrors, setInvoiceErrors] = useState<Partial<Record<keyof InvoiceInfo, string>>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      const email = session?.user?.email ?? "";
      setUserEmail(email);
      const saved = getInvoiceInfo();
      if (saved) {
        setInvoice(saved);
        setHasSavedInvoice(true);
      } else {
        setInvoice((prev) => ({ ...prev, email: prev.email || email }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const returnPath = params.get("return") || "";
  const unlockParam = params.get("unlock") || "";

  const handleBuy = (key: string) => {
    setPendingKey(key);
    setInvoiceErrors({});
    setShowVnpay(true);
  };

  const validateInvoice = (): boolean => {
    const errs: Partial<Record<keyof InvoiceInfo, string>> = {};
    if (!invoice.companyName.trim()) errs.companyName = "Vui lòng nhập tên công ty";
    if (!invoice.taxCode.trim()) errs.taxCode = "Vui lòng nhập mã số thuế";
    if (!invoice.address.trim()) errs.address = "Vui lòng nhập địa chỉ";
    if (!invoice.email.trim()) errs.email = "Vui lòng nhập email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.email.trim())) errs.email = "Email không hợp lệ";
    setInvoiceErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const confirmVnpayPay = () => {
    if (!pendingKey) return;
    if (wantInvoice) {
      if (!validateInvoice()) return;
      saveInvoiceInfo({
        companyName: invoice.companyName.trim(),
        taxCode: invoice.taxCode.trim(),
        address: invoice.address.trim(),
        email: invoice.email.trim(),
      });
      setHasSavedInvoice(true);
    }
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
            <h2 className="text-lg font-semibold text-foreground">Mua thêm credit</h2>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="mt-1 min-h-[40px] flex flex-col items-center justify-center">
                <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-primary" />
                  {pkg.baseCredits} credit
                </p>
                {pkg.credits > pkg.baseCredits && (
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 mt-0.5">
                    +{pkg.credits - pkg.baseCredits} credit tặng thêm
                  </p>
                )}
              </div>
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

      {/* Lịch sử giao dịch */}
      <Card className="mt-6 p-5 md:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Lịch sử giao dịch</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Các giao dịch credit gần đây của bạn
          </p>
        </div>

        {transactions.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Chưa có giao dịch nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Lịch sử mua và sử dụng credit của bạn sẽ hiển thị tại đây
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Thời gian</TableHead>
                  <TableHead>Giao dịch</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

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
