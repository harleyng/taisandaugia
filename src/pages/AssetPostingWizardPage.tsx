import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AssetPostingWizard } from "@/components/asset-posting/AssetPostingWizard";
import { AssetPostingsLanding } from "@/components/asset-posting/AssetPostingsLanding";

/**
 * Danh sách hồ sơ + wizard số hoá tài sản.
 *
 * Cổng KYC chủ tài sản nằm ở layout route (OwnerKycGate) để dùng chung với
 * trang chi tiết `/chu-tai-san/dang-tai-san/:id`. Chi tiết là route riêng chứ
 * không còn là một "mode" ở đây — link được, tải lại không mất.
 */
const AssetPostingWizardPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"list" | "wizard">("list");
  const [draftId, setDraftId] = useState<string | null>(null);

  if (mode === "wizard") {
    return (
      <AssetPostingWizard
        postingId={draftId}
        onDone={() => {
          setDraftId(null);
          setMode("list");
        }}
        onCancel={() => {
          setDraftId(null);
          setMode("list");
        }}
      />
    );
  }

  return (
    <AssetPostingsLanding
      onCreate={() => {
        setDraftId(null);
        setMode("wizard");
      }}
      onResumeDraft={(id) => {
        setDraftId(id);
        setMode("wizard");
      }}
      onSelect={(id) => navigate(`/chu-tai-san/dang-tai-san/${id}`)}
    />
  );
};

export default AssetPostingWizardPage;
