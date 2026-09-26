/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssetOwnerWorkspace } from "@/hooks/useAssetOwnerWorkspace";
import { useClaimWriteAccess, useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerAssetOutcomes } from "@/hooks/useOwnerAssetOutcomes";
import { useStoredChoice } from "@/hooks/useStoredChoice";
import { ClaimsTable } from "@/components/asset-owner-management/ClaimsTable";
import { ReportOutcomeDialog } from "@/components/asset-owner-portal/outcomes/ReportOutcomeDialog";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { AssetViewToggle } from "@/components/asset-owner-portal/pipeline/AssetViewToggle";
import { PipelineView } from "@/components/asset-owner-portal/pipeline/PipelineView";
import { OWNER_ASSETS_VIEWS, OWNER_ASSETS_VIEW_KEY } from "@/components/asset-owner-portal/pipeline/assetsView";
import { claimToReportTarget, type ReportOutcomeTarget } from "@/lib/ownerOutcomeReport";

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

  const { userId, loading: authLoading } = useAuth();
  const [kycStatus, setKycStatus] = useState<UserKYCStatus | null>(null);

  // Không gian đến từ tư cách THÀNH VIÊN — người được mời không có KYC riêng
  // vẫn thấy danh mục. KYC cá nhân chỉ còn quyết định màn trống khi chưa có không gian.
  const {
    workspace, wsLoading,
    claims, claimsLoading,
    roundCountsByListing,
    confirmClaim, rejectClaim, confirmAllPending,
  } = useAssetOwnerWorkspace();
  const { canWriteClaim, canConfirmAll } = useClaimWriteAccess();
  const { isPersonal } = useOwnerWorkspace();
  const { byListing: outcomesByListing, isLoading: outcomesLoading } = useOwnerAssetOutcomes(workspace?.id);
  // Bảng / Giai đoạn — tiện ích theo trình duyệt (Phase 12).
  const [view, setView] = useStoredChoice(OWNER_ASSETS_VIEW_KEY, OWNER_ASSETS_VIEWS, "table");

  // "Khai kết quả": giữ target khi đóng để dialog không trống chữ lúc đang tắt dần.
  const [reportTarget, setReportTarget] = useState<ReportOutcomeTarget | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const uid = userId;

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

      if (cancelled) return;
      setKycStatus({
        userId: uid,
        indApproved: !!indRes.data,
        indName: (indRes.data as any)?.full_name ?? null,
        orgApproved: !!orgRes.data,
        orgName: (orgRes.data as any)?.org_name ?? null,
      });
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const kycLoading = !!userId && kycStatus?.userId !== userId;

  if (authLoading || wsLoading || kycLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userId || !kycStatus) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Vui lòng đăng nhập để tiếp tục.</p>
      </div>
    );
  }

  if (!workspace && !kycStatus.indApproved && !kycStatus.orgApproved) {
    return (
      <div className="flex items-center justify-center py-24">
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
  const isLoadingData = claimsLoading;
  // Đường ống cần một tenant: không gian (tin đã nhận + hồ sơ) hoặc Cá nhân (hồ sơ).
  const hasBoard = !!workspace || isPersonal;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Tài sản"
        subtitle={
          isPersonal
            ? "Hồ sơ số hoá của bạn — từ số hoá tới thu tiền."
            : "Tài sản của đơn vị — từ số hoá tới thu tiền."
        }
        actions={hasBoard && <AssetViewToggle view={view} onChange={setView} />}
      />

      {hasBoard && view === "kanban" ? (
        <PipelineView
          claims={claims}
          outcomesByListing={outcomesByListing}
          loading={claimsLoading || outcomesLoading}
          onShowTable={() => setView("table")}
        />
      ) : isLoadingData ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : workspace || isOrgApproved ? (
        workspace ? (
          <>
            <ClaimsTable
              claims={claims}
              roundCountsByListing={roundCountsByListing}
              outcomesByListing={outcomesByListing}
              onConfirm={(id) => confirmClaim.mutate(id)}
              onReject={(id) => rejectClaim.mutate({ claimId: id })}
              onConfirmAll={() => confirmAllPending.mutate()}
              isProcessing={confirmClaim.isPending || rejectClaim.isPending || confirmAllPending.isPending}
              initialMatchedName={initialMatchedName}
              canWriteClaim={canWriteClaim}
              canConfirmAll={canConfirmAll}
              onReportOutcome={(claim) => {
                const target = claimToReportTarget(claim);
                if (!target) return;
                setReportTarget(target);
                setReportOpen(true);
              }}
            />
            <ReportOutcomeDialog
              open={reportOpen}
              onOpenChange={setReportOpen}
              workspaceId={workspace.id}
              target={reportTarget}
            />
          </>
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
