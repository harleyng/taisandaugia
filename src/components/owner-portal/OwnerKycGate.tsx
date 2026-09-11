import { Outlet, useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOwnerKycApproved } from "@/hooks/useOwnerKycApproved";

/**
 * Layout route cho khu số hoá tài sản (`/chu-tai-san/dang-tai-san/*`): phải là
 * chủ tài sản đã được duyệt KYC (cá nhân hoặc tổ chức) — cùng cổng với
 * OwnerAssetsPage. Đặt ở layout để danh sách và chi tiết hồ sơ dùng chung.
 */
export function OwnerKycGate() {
  const navigate = useNavigate();
  const { data: approved, isPending } = useOwnerKycApproved();

  if (isPending) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Chưa xác thực Chủ tài sản</p>
            <p className="text-sm text-muted-foreground mt-1">
              Hoàn thành xác thực Chủ tài sản để đăng tài sản và gửi yêu cầu tới tổ chức đấu giá.
            </p>
          </div>
          <Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Bắt đầu xác thực</Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
