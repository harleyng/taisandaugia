import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AssetPostingWizard } from "@/components/asset-posting/AssetPostingWizard";
import { AssetPostingsLanding } from "@/components/asset-posting/AssetPostingsLanding";
import { AssetPostingDetail } from "@/components/asset-posting/AssetPostingDetail";

/**
 * Route page cho wizard đăng tài sản. Gate: phải là chủ tài sản đã được duyệt KYC
 * (cá nhân hoặc tổ chức) — tái dùng đúng cổng gating của OwnerAssetsPage.
 */
const AssetPostingWizardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [mode, setMode] = useState<"list" | "wizard" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const uid = session.user.id;
      const [indRes, orgRes] = await Promise.all([
        supabase.from("asset_owner_kyc").select("status").eq("user_id", uid).eq("status", "approved").maybeSingle(),
        supabase
          .from("asset_owner_org_kyc")
          .select("status")
          .eq("created_by", uid)
          .eq("status", "approved")
          .maybeSingle(),
      ]);
      setApproved(!!indRes.data || !!orgRes.data);
      setLoading(false);
    };
    check();
  }, []);

  if (loading) {
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

  if (mode === "wizard") {
    return <AssetPostingWizard onDone={() => setMode("list")} onCancel={() => setMode("list")} />;
  }

  if (mode === "detail" && selectedId) {
    return <AssetPostingDetail postingId={selectedId} onBack={() => setMode("list")} />;
  }

  return (
    <AssetPostingsLanding
      onCreate={() => setMode("wizard")}
      onSelect={(id) => {
        setSelectedId(id);
        setMode("detail");
      }}
    />
  );
};

export default AssetPostingWizardPage;
