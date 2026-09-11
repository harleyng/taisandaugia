import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AssetPostingDetail } from "@/components/asset-posting/AssetPostingDetail";

const LIST_PATH = "/chu-tai-san/dang-tai-san";

/**
 * Chi tiết một hồ sơ số hoá — route riêng để báo giá / hợp đồng có đường link
 * trực tiếp và tải lại trang không mất chỗ đang xem. Cổng KYC nằm ở layout cha.
 */
const AssetPostingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return <Navigate to={LIST_PATH} replace />;

  return <AssetPostingDetail key={id} postingId={id} onBack={() => navigate(LIST_PATH)} />;
};

export default AssetPostingDetailPage;
