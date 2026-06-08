/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2, CheckCircle2, User, Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useAssetOwnerWorkspace } from "@/hooks/useAssetOwnerWorkspace";
import { ClaimsTable } from "@/components/asset-owner-management/ClaimsTable";
import { ManualClaimSearch } from "@/components/asset-owner-onboarding/organization/tier2/ManualClaimSearch";
import { useQueryClient } from "@tanstack/react-query";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserKYCStatus {
  userId: string;
  indApproved: boolean;
  indName: string | null;
  orgApproved: boolean;
  orgName: string | null;
}

// ─── Main page ───────────────────────────────────────────────────────────────

const AssetOwnerManagement = () => {
  const navigate = useNavigate();
  const { openAuthDialog } = useAuthDialog();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<UserKYCStatus | null>(null);

  const userId = kycStatus?.userId ?? null;

  const {
    workspace, wsLoading,
    claims, claimsLoading,
    runMatch,
    confirmClaim, rejectClaim, confirmAllPending,
  } = useAssetOwnerWorkspace(userId);

  // ─── Load auth + KYC status ──────────────────────────────────────────────

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

  // ─── Guards ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!kycStatus) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm px-4">
            <p className="text-muted-foreground">Vui lòng đăng nhập để tiếp tục.</p>
            <Button onClick={() => openAuthDialog(() => window.location.reload())}>Đăng nhập</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not KYC'd yet
  if (!kycStatus.indApproved && !kycStatus.orgApproved) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">Chưa xác thực Chủ tài sản</p>
            <p className="text-sm text-muted-foreground">Hoàn thành KYC trước để quản lý tài sản.</p>
            <Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Bắt đầu xác thực</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const isOrgApproved = kycStatus.orgApproved;
  const displayName = isOrgApproved
    ? (kycStatus.orgName ?? "Tổ chức")
    : (kycStatus.indName ?? "Cá nhân");

  const isLoadingData = wsLoading || claimsLoading;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6 md:py-8 max-w-5xl">
        <div className="space-y-6">
          {/* Page header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  {isOrgApproved ? <Building2 className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
                </div>
                <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  Đã xác thực
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {isOrgApproved ? "Tài sản của tổ chức" : "Tài sản cá nhân"} · Quản lý danh mục đã claim
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {workspace && (
                <Button
                  size="sm"
                  onClick={() => navigate("/chu-tai-san/dashboard")}
                >
                  Xem Dashboard
                </Button>
              )}
              {isOrgApproved && workspace && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => runMatch.mutate()}
                  disabled={runMatch.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${runMatch.isPending ? "animate-spin" : ""}`} />
                  {runMatch.isPending ? "Đang cập nhật..." : "Cập nhật danh sách"}
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          {isLoadingData ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isOrgApproved ? (
            /* ── Org view ── */
            workspace ? (
              <ClaimsTable
                claims={claims}
                onConfirm={(id) => confirmClaim.mutate(id)}
                onReject={(id) => rejectClaim.mutate({ claimId: id })}
                onConfirmAll={() => confirmAllPending.mutate()}
                isProcessing={confirmClaim.isPending || rejectClaim.isPending || confirmAllPending.isPending}
              />
            ) : (
              <div className="text-center py-12 space-y-3">
                <p className="text-muted-foreground text-sm">
                  Workspace chưa được tạo. Vui lòng hoàn thành bước claim tài sản.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate("/tro-thanh-chu-tai-san")}>
                  Tiếp tục claim tài sản
                </Button>
              </div>
            )
          ) : (
            /* ── Individual view ── */
            <div className="space-y-5">
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm text-foreground">
                Tìm tài sản của bạn theo địa chỉ hoặc tên listing để thêm vào danh mục cá nhân.
              </div>

              {/* Individual doesn't have workspace — use a placeholder workspace id */}
              {/* For now, show search only; full individual claim mechanism in Phase 2 */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground mb-3">Tìm tài sản của bạn</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Nhập địa chỉ hoặc mô tả tài sản để tìm trong cơ sở dữ liệu đấu giá.
                </p>
                {/* Individual claim is workspace-less — show search with placeholder */}
                <div className="text-sm text-muted-foreground italic py-6 text-center border border-dashed border-border rounded-xl">
                  Tính năng tìm và claim tài sản cá nhân sẽ sớm ra mắt.
                  <br />
                  <button
                    onClick={() => navigate("/listings")}
                    className="text-primary hover:underline mt-2 block"
                  >
                    Tìm kiếm tài sản trên sàn →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AssetOwnerManagement;
