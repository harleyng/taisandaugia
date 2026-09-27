import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AssetPostingWizard } from "@/components/asset-posting/AssetPostingWizard";
import { AssetPostingsLanding } from "@/components/asset-posting/AssetPostingsLanding";
import { WIZARD_POSTING_PARAM, ownerPostingPath } from "@/lib/asset-posting/paths";

/**
 * Danh sách hồ sơ + wizard số hoá tài sản.
 *
 * Cổng KYC chủ tài sản nằm ở layout route (OwnerKycGate) để dùng chung với
 * trang chi tiết `/chu-tai-san/dang-tai-san/:id`. Wizard cho hồ sơ ĐÃ CÓ mở qua
 * `?ho-so=<id>` (nút "Tiếp tục số hoá" / "Sửa hồ sơ" ở chi tiết) và thoát về chính
 * trang chi tiết đó; tạo mới vẫn là state của trang, thoát về danh sách.
 */
const AssetPostingWizardPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const editId = params.get(WIZARD_POSTING_PARAM);

  if (editId) {
    const back = () => navigate(ownerPostingPath(editId), { replace: true });
    return <AssetPostingWizard key={editId} postingId={editId} onDone={back} onCancel={back} />;
  }

  if (creating) {
    return <AssetPostingWizard onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />;
  }

  return <AssetPostingsLanding onCreate={() => setCreating(true)} hrefOf={ownerPostingPath} />;
};

export default AssetPostingWizardPage;
