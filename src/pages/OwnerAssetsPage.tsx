/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssetOwnerWorkspace } from "@/hooks/useAssetOwnerWorkspace";
import { ClaimsTable } from "@/components/asset-owner-management/ClaimsTable";

interface UserKYCStatus {
  userId: string;
  indApproved: boolean;
  indName: string | null;
  orgApproved: boolean;
  orgName: string | null;
}

// ─── Page ───────────────────────────────────────────────────────────────────

const OwnerAssetsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMatchedName = searchParams.get("source") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<UserKYCStatus | null>(null);

  const userId = kycStatus?.userId ?? null;

  const {
    workspace, wsLoading,
    claims, claimsLoading,
    roundCountsByListing,
    confirmClaim, rejectClaim, confirmAllPending,
  } = useAssetOwnerWorkspace(userId);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const uid = session.user.id;

      const [indRes, orgRes] = await Promise.all([
        supabase
          .from("asset_owner_kyc")
          .select("status, full_name")
          .eq("user_id", uid)
          .eq("status", "approved")
          .maybeSingle(),
        supabase
          .from("asset_owner_org_kyc")
          .select("status, org_name")
          .eq("created_by", uid)
          .eq("status", "approved")
          .maybeSingle(),
      ]);

      setKycStatus({
        userId: uid,
        indApproved: !!indRes.data,
        indName: (indRes.data as any)?.full_name ?? null,
        orgApproved: !!orgRes.data,
        orgName: (orgRes.data as any)?.org_name ?? null,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kycStatus) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Vui lòng đăng nhập để tiếp tục.</p>
      </div>
    );
  }

  if (!kycStatus.indApproved && !kycStatus.orgApproved) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <PackageOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Chưa xác thực Chủ tài sản</p>
            <p className="text-sm text-muted-foreground mt-1">
              Hoàn thành xác thực để claim và quản lý danh sách tài sản của bạn.
            </p>
          </div>
          <Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>
            Bắt đầu xác thực
          </Button>
        </div>
      </div>
    );
  }

  const isOrgApproved = kycStatus.orgApproved;
  const isLoadingData = wsLoading || claimsLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Content */}
      {isLoadingData ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isOrgApproved ? (
        workspace ? (
          <ClaimsTable
            claims={claims}
            roundCountsByListing={roundCountsByListing}
            onConfirm={(id) => confirmClaim.mutate(id)}
            onReject={(id) => rejectClaim.mutate({ claimId: id })}
            onConfirmAll={() => confirmAllPending.mutate()}
            isProcessing={confirmClaim.isPending || rejectClaim.isPending || confirmAllPending.isPending}
            initialMatchedName={initialMatchedName}
          />
        ) : (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-4 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <PackageOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Chưa có tài sản nào</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Hoàn thành bước claim tài sản để tài sản xuất hiện ở đây.
                </p>
              </div>
              <Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>
                Tiếp tục claim tài sản
              </Button>
            </div>
          </div>
        )
      ) : (
        /* Individual approved */
        <div className="space-y-5">
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm text-foreground">
            Tìm tài sản của bạn theo địa chỉ hoặc tên listing để thêm vào danh mục cá nhân.
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-3">Tìm tài sản của bạn</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Nhập địa chỉ hoặc mô tả tài sản để tìm trong cơ sở dữ liệu đấu giá.
            </p>
            <div className="text-sm text-muted-foreground italic py-6 text-center border border-dashed border-border rounded-xl">
              Tính năng tìm và claim tài sản cá nhân sẽ sớm ra mắt.
              <br />
              <button
                onClick={() => navigate("/listings")}
                className="text-primary hover:underline mt-2 block mx-auto"
              >
                Tìm kiếm tài sản trên sàn →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerAssetsPage;
