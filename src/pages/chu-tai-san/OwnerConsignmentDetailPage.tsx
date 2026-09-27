import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ConsignmentDetail } from "@/components/asset-posting/ConsignmentDetail";
import { OWNER_CONSIGNMENTS_PATH } from "@/lib/consignment/ownerConsignment";

/**
 * Chi tiết ký gửi của một hồ sơ — route riêng để link báo giá / hợp đồng gửi
 * cho người khác được và tải lại không mất chỗ. Cổng KYC nằm ở layout cha.
 */
export default function OwnerConsignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return <Navigate to={OWNER_CONSIGNMENTS_PATH} replace />;

  return <ConsignmentDetail key={id} postingId={id} onBack={() => navigate(OWNER_CONSIGNMENTS_PATH)} />;
}
