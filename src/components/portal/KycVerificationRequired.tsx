import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useKycStatus } from "@/hooks/useKycStatus";

export const KycVerificationRequired = () => {
  const navigate = useNavigate();
  const { kycStatus, rejectionReason } = useKycStatus();

  if (kycStatus === "APPROVED") {
    return null;
  }

  if (kycStatus === "PENDING_KYC") {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">Hồ sơ đang chờ duyệt</AlertTitle>
        <AlertDescription className="text-blue-700">
          Hồ sơ đăng ký môi giới của bạn đang được xem xét. Chúng tôi sẽ thông báo kết quả sớm nhất.
          Bạn cần hoàn thành xác thực để sử dụng tính năng này.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Yêu cầu xác thực</AlertTitle>
          <AlertDescription>
            {kycStatus === "REJECTED" && rejectionReason
              ? `Hồ sơ của bạn bị từ chối: ${rejectionReason}`
              : "Bạn cần hoàn thành đăng ký môi giới và xác thực để sử dụng tính năng này."}
          </AlertDescription>
        </Alert>
        
        <p className="text-muted-foreground mb-6">
          Vui lòng hoàn thành form đăng ký môi giới trong phần "Hồ sơ cá nhân" để được sử dụng các tính năng của broker.
        </p>
        
        <Button onClick={() => navigate("/broker/profile")}>
          Đi đến Hồ sơ cá nhân
        </Button>
      </div>
    </div>
  );
};
