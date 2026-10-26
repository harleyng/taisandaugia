import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AssetPostingWizard } from "@/components/asset-posting/AssetPostingWizard";
import { AssetPostingsLanding } from "@/components/asset-posting/AssetPostingsLanding";
import { WIZARD_PLAN_ITEM_PARAM, WIZARD_POSTING_PARAM, ownerPostingPath } from "@/lib/asset-posting/paths";
import { useLinkPostingToPlanItem, usePlanItemPostingPrefill } from "@/hooks/usePlanItemPosting";
import { ownerPlanTabHref } from "@/lib/auctionPlan/routes";

/**
 * Danh sách hồ sơ + wizard số hoá tài sản.
 *
 * Cổng KYC chủ tài sản nằm ở layout route (OwnerKycGate) để dùng chung với
 * trang chi tiết `/chu-tai-san/dang-tai-san/:id`. Wizard cho hồ sơ ĐÃ CÓ mở qua
 * `?ho-so=<id>` (nút "Tiếp tục số hoá" / "Sửa hồ sơ" ở chi tiết) và thoát về chính
 * trang chi tiết đó; tạo mới vẫn là state của trang, thoát về danh sách.
 *
 * `?tu-ke-hoach=<id mục kế hoạch>` (Phase 5 của kế hoạch đấu giá) mở wizard TẠO
 * MỚI đã điền trước tên / địa chỉ / diện tích / giá khởi điểm, và liên kết hồ sơ
 * về mục đó ngay khi có bản nháp đầu tiên; thoát thì về tab "Tiến độ" của kế
 * hoạch. Luật kiểm tra của wizard KHÔNG đổi.
 */
const AssetPostingWizardPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const editId = params.get(WIZARD_POSTING_PARAM);
  const planItemId = params.get(WIZARD_PLAN_ITEM_PARAM);

  const { item: planItem, prefill, isLoading: prefillLoading } = usePlanItemPostingPrefill(planItemId);
  const linkToPlanItem = useLinkPostingToPlanItem(planItem);

  if (editId) {
    const back = () => navigate(ownerPostingPath(editId), { replace: true });
    return <AssetPostingWizard key={editId} postingId={editId} onDone={back} onCancel={back} />;
  }

  if (planItemId && !prefillLoading && planItem && prefill) {
    const back = () => navigate(ownerPlanTabHref(planItem.plan_id, "tien-do"), { replace: true });
    return (
      <AssetPostingWizard
        key={planItemId}
        prefill={prefill}
        onPostingSaved={linkToPlanItem}
        onDone={back}
        onCancel={back}
      />
    );
  }

  if (creating) {
    return <AssetPostingWizard onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />;
  }

  return <AssetPostingsLanding onCreate={() => setCreating(true)} hrefOf={ownerPostingPath} />;
};

export default AssetPostingWizardPage;
