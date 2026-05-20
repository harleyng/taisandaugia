import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle2, LayoutDashboard, FileText, Users, Star, ArrowRight, Rocket } from "lucide-react";
import confetti from "canvas-confetti";

interface ActivationSuccessProps {
  companyName?: string;
}

const UNLOCKED_FEATURES = [
  { icon: FileText, label: "Đăng và quản lý phiên đấu giá", desc: "Tạo mới, chỉnh sửa, theo dõi trạng thái" },
  { icon: Users, label: "Quản lý hồ sơ người tham gia", desc: "Danh sách đăng ký, xét duyệt tư cách" },
  { icon: LayoutDashboard, label: "Dashboard công ty", desc: "Báo cáo doanh thu, phân tích hoạt động" },
  { icon: Star, label: "Hồ sơ năng lực công ty", desc: "Trang giới thiệu công ty trên nền tảng" },
];

export const ActivationSuccess = ({ companyName }: ActivationSuccessProps) => {
  useEffect(() => {
    // Fire confetti
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        ...opts,
        origin: { y: 0.6 },
        particleCount: Math.floor(200 * particleRatio),
      });
    };

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, []);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-center text-white space-y-3 shadow-xl">
        <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <Rocket className="h-8 w-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Tài khoản đã kích hoạt!</h2>
          {companyName && (
            <p className="text-white/80 text-sm mt-1">
              {companyName}
            </p>
          )}
          <p className="text-white/90 text-sm mt-2">
            Chào mừng bạn gia nhập nền tảng đấu giá tài sản hàng đầu Việt Nam.
          </p>
        </div>
      </div>

      {/* Unlocked features */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tính năng đã mở khóa</p>
        <div className="space-y-2.5">
          {UNLOCKED_FEATURES.map(({ icon: Icon, label, desc }, i) => (
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

      {/* CTA */}
      <div className="space-y-2.5">
        <Button className="w-full" asChild>
          <Link to="/auction-org/cty-001">
            <Star className="mr-2 h-4 w-4" />
            Tạo hồ sơ năng lực ngay
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <Link to="/">
            Về trang chủ
          </Link>
        </Button>
      </div>
    </div>
  );
};
