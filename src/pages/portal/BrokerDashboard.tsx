import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Users, Eye, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useKycStatus } from "@/hooks/useKycStatus";
import { useIsMobile } from "@/hooks/use-mobile";

export default function BrokerDashboard() {
  const navigate = useNavigate();
  const { kycStatus, loading } = useKycStatus();
  const isMobile = useIsMobile();

  const stats = [
    {
      title: "Tin đăng hoạt động",
      value: "12",
      change: "+2 tuần này",
      icon: Building,
    },
    {
      title: "Tổng lượt xem",
      value: "1,284",
      change: "+15% so với tháng trước",
      icon: Eye,
    },
    {
      title: "Khách hàng",
      value: "45",
      change: "+5 mới tháng này",
      icon: Users,
    },
    {
      title: "Tỷ lệ chuyển đổi",
      value: "12.5%",
      change: "+2.3% so với tháng trước",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-foreground">
          {isMobile ? "Tổng quan" : "Tổng quan"}
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
          Chào mừng đến với broker dashboard
        </p>
      </div>

      {/* KYC Status Alert - Mobile Optimized */}
      {!loading && kycStatus !== "APPROVED" && (
        <Alert variant={kycStatus === "REJECTED" ? "destructive" : "default"} className="touch-manipulation">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <AlertTitle className="text-sm md:text-base">
              {kycStatus === "PENDING_KYC" ? "Hồ sơ đang chờ duyệt" : 
               kycStatus === "REJECTED" ? "Hồ sơ bị từ chối" : 
               "Cần hoàn thành xác thực"}
            </AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between text-xs md:text-sm">
              <span className="flex-1">
                {kycStatus === "PENDING_KYC" 
                  ? "Hồ sơ của bạn đang được xem xét. Một số tính năng có thể bị hạn chế."
                  : "Vui lòng hoàn thành đăng ký môi giới để sử dụng đầy đủ tính năng."}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/broker/profile")}
                className="sm:ml-4 w-full sm:w-auto touch-manipulation active:scale-95"
              >
                {kycStatus === "NOT_APPLIED" ? "Đăng ký ngay" : "Xem hồ sơ"}
              </Button>
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Stats Grid - Mobile Optimized */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-md transition-shadow touch-manipulation">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium line-clamp-2">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardHeader>
              <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
                <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2 mt-1">
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom Cards - Mobile Optimized */}
      <div className="grid gap-3 md:gap-4 md:grid-cols-2">
        <Card className="touch-manipulation">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">Hoạt động gần đây</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Các hoạt động mới nhất của bạn
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <p className="text-xs md:text-sm text-muted-foreground">Chưa có hoạt động nào</p>
          </CardContent>
        </Card>

        <Card className="touch-manipulation">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">Thao tác nhanh</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Các tác vụ phổ biến và lối tắt
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <p className="text-xs md:text-sm text-muted-foreground">Tính năng sắp ra mắt</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
