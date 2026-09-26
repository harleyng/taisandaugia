import { Outlet, useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";

/**
 * Layout route cho khu số hoá tài sản (`/chu-tai-san/dang-tai-san/*`): phải có
 * một TENANT — thành viên của một không gian (kể cả Cán bộ/Người xem được mời, họ
 * không có KYC riêng) hoặc tenant Cá nhân (KYC cá nhân đã duyệt). Quyền ghi từng
 * hồ sơ do trang con quyết định. Đặt ở layout để danh sách và chi tiết dùng chung.
 */
export function OwnerKycGate() {
  const navigate = useNavigate();
  const { workspaceId, isPersonal, isLoading } = useOwnerWorkspace();
  const approved = !!workspaceId || isPersonal;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="flex items-center justify-center py-24">
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
