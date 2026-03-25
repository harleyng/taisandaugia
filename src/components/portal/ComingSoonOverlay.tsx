import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, Lock } from "lucide-react";
import { useKycStatus } from "@/hooks/useKycStatus";

interface ComingSoonOverlayProps {
  children: React.ReactNode;
}

export const ComingSoonOverlay = ({ children }: ComingSoonOverlayProps) => {
  const navigate = useNavigate();
  const { kycStatus, loading } = useKycStatus();

  if (loading) {
    return <div>Đang tải...</div>;
  }

  // If approved, show content without overlay
  if (kycStatus === "APPROVED") {
    return <>{children}</>;
  }

  // Show content with overlay for non-approved users
  return (
    <div className="relative">
      {/* Show the content but make it slightly faded */}
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      
      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-center max-w-md p-8 bg-card border rounded-lg shadow-lg">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-2">Tính năng đang khóa</h2>
          
          {kycStatus === "PENDING_KYC" && (
            <p className="text-muted-foreground mb-6">
              Hồ sơ của bạn đang được xem xét. Vui lòng chờ xét duyệt để sử dụng tính năng này.
            </p>
          )}
          
          {kycStatus === "REJECTED" && (
            <p className="text-muted-foreground mb-6">
              Hồ sơ của bạn bị từ chối. Vui lòng cập nhật hồ sơ trong phần "Hồ sơ cá nhân" để tiếp tục.
            </p>
          )}
          
          {kycStatus === "NOT_APPLIED" && (
            <p className="text-muted-foreground mb-6">
              Bạn cần hoàn thành đăng ký môi giới trong phần "Hồ sơ cá nhân" để sử dụng tính năng này.
            </p>
          )}
          
          <Button onClick={() => navigate("/broker/profile")} className="w-full">
            <AlertCircle className="mr-2 h-4 w-4" />
            Đi đến Hồ sơ cá nhân
          </Button>
        </div>
      </div>
    </div>
  );
};
