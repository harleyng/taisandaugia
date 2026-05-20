import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Info, ArrowRight, User, Building2, CheckCircle2, FileText, BarChart2, Bell, Rocket } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";

const COPY = {
  personal: {
    icon: User,
    title: "Kích hoạt tài khoản cá nhân",
    subtitle: "Nạp tiền vào ví cá nhân để kích hoạt",
    why: "Tại sao cần nạp 1$?",
    explanation: "Đây là <strong>số dư ví cá nhân</strong> của bạn, không phải phí đăng ký. Số tiền này dùng để kích hoạt đầy đủ tính năng và có thể sử dụng cho các giao dịch trong hệ thống.",
    walletLabel: "ví cá nhân",
    successMessage: "Tài khoản cá nhân đã được kích hoạt!",
  },
  company: {
    icon: Building2,
    title: "Nạp tiền kích hoạt công ty",
    subtitle: "Nạp tiền vào ví công ty để hoàn tất đăng ký",
    why: "Tại sao cần nạp 1$?",
    explanation: "Đây là <strong>số dư ví công ty</strong> của bạn, không phải phí đăng ký. Số tiền này dùng để kích hoạt tính năng quản lý đấu giá và có thể sử dụng cho các giao dịch trong hệ thống.",
    walletLabel: "ví công ty",
    successMessage: "Nạp tiền thành công! Tài khoản công ty đã được kích hoạt.",
  },
};

const PERSONAL_FEATURES = [
  { icon: FileText, label: "Truy cập đầy đủ thông tin tài sản", desc: "Mở khóa tiền đặt cọc, tài liệu đính kèm và nhiều hơn nữa..." },
  { icon: BarChart2, label: "Quyết định dựa trên dữ liệu thật", desc: "Báo cáo thị trường tổng hợp từ hàng trăm nghìn phiên đấu giá" },
  { icon: Bell, label: "Theo dõi cơ hội của bạn 24/7", desc: "Thông báo realtime khi tài sản quan tâm có thay đổi hoặc có tài sản mới" },
];

const PersonalSuccessView = ({ onContinue }: { onContinue: () => void }) => {
  useEffect(() => {
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({ ...opts, origin: { y: 0.6 }, particleCount: Math.floor(200 * particleRatio) });
    };
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, []);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-center text-white space-y-3">
        <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <Rocket className="h-8 w-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Chào mừng bạn!</h2>
          <p className="text-white/90 text-sm mt-1">
            Tài khoản cá nhân đã được kích hoạt thành công.
          </p>
        </div>
      </div>

      {/* Unlocked features */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tính năng đã mở khóa</p>
        <div className="space-y-2.5">
          {PERSONAL_FEATURES.map(({ icon: Icon, label, desc }, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <Button className="w-full" onClick={onContinue}>
        Bắt đầu khám phá
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

interface DepositCardProps {
  context: "personal" | "company";
  onComplete: () => void;
  onSkip?: () => void;
}

export const DepositCard = ({ context, onComplete, onSkip }: DepositCardProps) => {
  const [amount, setAmount] = useState("1");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const copy = COPY[context];
  const Icon = copy.icon;
  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount >= 1;

  const handleDeposit = () => {
    if (!isValid) return;
    setLoading(true);
    setTimeout(async () => {
      setLoading(false);
      if (context === "personal") {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          localStorage.setItem(`activated_${session.user.id}`, "true");
        }
        toast.success(copy.successMessage);
        setShowSuccess(true);
      } else {
        toast.success(copy.successMessage, {
          description: `${numAmount} USD đã được nạp vào ${copy.walletLabel}.`,
        });
        onComplete();
      }
    }, 1500);
  };

  if (showSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-xl border-border">
        <CardContent className="pt-6">
          <PersonalSuccessView onContinue={onComplete} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-border">
      <CardHeader>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">{copy.title}</CardTitle>
            <CardDescription>{copy.subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">{copy.why}</p>
            <p
              className="text-xs leading-relaxed"
              dangerouslySetInnerHTML={{ __html: copy.explanation }}
            />
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label className="font-medium">Số tiền nạp (USD)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
            <Input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-7"
            />
          </div>
          {numAmount < 1 && amount !== "" && (
            <p className="text-xs text-destructive">Số tiền tối thiểu là 1 USD</p>
          )}
        </div>

        {/* Payment method — VNPay only in phase 1 */}
        <div className="space-y-2">
          <Label className="font-medium">Phương thức thanh toán</Label>
          <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-3">
            <span className="text-2xl">🏦</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">VNPay</p>
              <p className="text-xs text-muted-foreground">Ví VNPay / QR Code / ATM nội địa</p>
            </div>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Duy nhất</span>
          </div>
        </div>

        {/* Summary */}
        {isValid && (
          <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Số tiền</span>
              <span className="font-medium">${numAmount} USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phương thức</span>
              <span className="font-medium">VNPay</span>
            </div>
            <div className="border-t border-border pt-1.5 flex justify-between">
              <span className="font-semibold">Số dư {copy.walletLabel} sau nạp</span>
              <span className="font-bold text-primary">${numAmount} USD</span>
            </div>
          </div>
        )}

        <Button className="w-full" onClick={handleDeposit} disabled={!isValid || loading}>
          {loading ? "Đang xử lý..." : `Xác nhận nạp $${numAmount} qua VNPay`}
          {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Giao dịch được bảo mật và mã hóa. Bạn sẽ được chuyển đến cổng VNPay sau khi xác nhận.
        </p>

        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Tiếp tục mà không đăng nhập
          </button>
        )}
      </CardContent>
    </Card>
  );
};
