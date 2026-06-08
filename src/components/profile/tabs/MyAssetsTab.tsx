import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Shield, ArrowRight, CheckCircle2, Clock, XCircle, Building2,
  User, Layers, Loader2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusScreen } from "@/components/asset-owner-onboarding/StatusScreen";
import type { AssetOwnerKYCStatus, AssetOwnerOrgKYCStatus } from "@/types/asset-owner";

const STATUS_BADGE: Record<AssetOwnerKYCStatus | AssetOwnerOrgKYCStatus, { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: "Chưa nộp", className: "bg-muted text-muted-foreground", icon: Clock },
  pending_review: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-700", icon: Clock },
  under_review: { label: "Đang xét duyệt", className: "bg-blue-100 text-blue-700", icon: Clock },
  approved: { label: "Đã xác thực", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Bị từ chối", className: "bg-red-100 text-red-700", icon: XCircle },
};

export const MyAssetsTab = ({ userId }: { userId: string | null }) => {
  const navigate = useNavigate();

  const { data: indKyc, isLoading: indLoading, refetch: refetchInd } = useQuery({
    queryKey: ["asset_owner_kyc", userId],
    enabled: !!userId,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_kyc")
        .select("id, status, rejection_reason, submitted_at")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; status: AssetOwnerKYCStatus; rejection_reason: string | null; submitted_at: string | null } | null;
    },
  });

  const { data: orgKyc, isLoading: orgLoading, refetch: refetchOrg } = useQuery({
    queryKey: ["asset_owner_org_kyc", userId],
    enabled: !!userId,
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_org_kyc")
        .select("id, status, org_name, org_type, rejection_reason, submitted_at")
        .eq("created_by", userId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string; status: AssetOwnerOrgKYCStatus;
        org_name: string | null; org_type: string | null;
        rejection_reason: string | null; submitted_at: string | null;
      } | null;
    },
  });

  const { data: workspace } = useQuery({
    queryKey: ["asset_owner_workspace", userId],
    enabled: !!userId && orgKyc?.status === "approved",
    queryFn: async () => {
      const { data } = await supabase
        .from("asset_owner_workspaces")
        .select("id, total_claimed, last_matched_at")
        .eq("owner_user_id", userId!)
        .maybeSingle();
      return data as { id: string; total_claimed: number; last_matched_at: string | null } | null;
    },
  });

  const isLoading = !!userId && (indLoading || orgLoading);
  const hasAny = indKyc || orgKyc;

  const indPending = indKyc?.status === "pending_review" || indKyc?.status === "under_review";
  const orgPending = orgKyc?.status === "pending_review" || orgKyc?.status === "under_review";

  const handleRefresh = () => { refetchInd(); refetchOrg(); };
  const goToOnboarding = () => navigate("/tro-thanh-chu-tai-san");
  const goToManagement = () => navigate("/chu-tai-san");

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-5 max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Layers className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground text-lg">Tài sản của tôi</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Xác thực vai trò Chủ tài sản để quản lý, theo dõi và đăng tài sản lên sàn đấu giá.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full text-left">
          <div className="rounded-xl border border-border p-3 space-y-1">
            <User className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-foreground">Cá nhân</p>
            <p className="text-[11px] text-muted-foreground">eKYC CCCD + selfie</p>
          </div>
          <div className="rounded-xl border border-border p-3 space-y-1">
            <Building2 className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-foreground">Tổ chức</p>
            <p className="text-[11px] text-muted-foreground">NH / AMC / THA / NN</p>
          </div>
        </div>
        <Button onClick={goToOnboarding} className="w-full gap-2">
          <Shield className="h-4 w-4" />
          Bắt đầu xác thực
          <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          onClick={handleRefresh}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
        >
          <RefreshCw className="h-3 w-3" />
          Đã xác thực rồi? Làm mới
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Individual KYC */}
      {indKyc && indPending && (
        <StatusScreen
          status={indKyc.status}
          isOrg={false}
          submittedAt={indKyc.submitted_at}
          hideBackButton
        />
      )}
      {indKyc && !indPending && (
        <KYCStatusCard
          icon={User}
          title="Cá nhân"
          status={indKyc.status}
          subtitle={
            indKyc.status === "rejected"
              ? indKyc.rejection_reason ?? "Hồ sơ bị từ chối"
              : indKyc.submitted_at
              ? `Nộp lúc ${new Date(indKyc.submitted_at).toLocaleDateString("vi-VN")}`
              : "Chưa nộp hồ sơ"
          }
          onAction={goToOnboarding}
          actionLabel={indKyc.status === "draft" || indKyc.status === "rejected" ? "Tiếp tục" : undefined}
        />
      )}

      {/* Org KYC */}
      {orgKyc && orgPending && (
        <StatusScreen
          status={orgKyc.status}
          isOrg
          orgName={orgKyc.org_name}
          submittedAt={orgKyc.submitted_at}
          hideBackButton
        />
      )}
      {orgKyc && !orgPending && (
        <KYCStatusCard
          icon={Building2}
          title={orgKyc.org_name ?? "Tổ chức"}
          status={orgKyc.status}
          subtitle={
            orgKyc.status === "rejected"
              ? orgKyc.rejection_reason ?? "Hồ sơ bị từ chối"
              : orgKyc.submitted_at
              ? `Nộp lúc ${new Date(orgKyc.submitted_at).toLocaleDateString("vi-VN")}`
              : "Chưa nộp hồ sơ"
          }
          onAction={orgKyc.status === "approved" ? goToManagement : goToOnboarding}
          actionLabel={
            orgKyc.status === "draft" || orgKyc.status === "rejected"
              ? "Tiếp tục"
              : orgKyc.status === "approved"
              ? "Quản lý tài sản"
              : undefined
          }
        />
      )}

      {/* Workspace stats (org approved) */}
      {workspace && (
        <div className="rounded-2xl border border-border p-5 space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Thống kê workspace</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/60 p-3 text-center">
              <p className="text-2xl font-bold text-primary">{workspace.total_claimed}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tài sản đã claim</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3 text-center">
              <p className="text-sm font-semibold text-foreground">
                {workspace.last_matched_at
                  ? new Date(workspace.last_matched_at).toLocaleDateString("vi-VN")
                  : "Chưa có"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Lần khớp cuối</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={goToManagement} className="w-full gap-1.5">
            Quản lý tài sản
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Add another type */}
      {indKyc && !orgKyc && (
        <button
          onClick={goToOnboarding}
          className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/40 p-4 text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          + Thêm xác thực Tổ chức
        </button>
      )}
    </div>
  );
};

const KYCStatusCard = ({
  icon: Icon,
  title,
  status,
  subtitle,
  onAction,
  actionLabel,
}: {
  icon: typeof User;
  title: string;
  status: AssetOwnerKYCStatus | AssetOwnerOrgKYCStatus;
  subtitle: string;
  onAction: () => void;
  actionLabel?: string;
}) => {
  const s = STATUS_BADGE[status];
  const StatusIcon = s.icon;

  return (
    <div className="rounded-2xl border border-border p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0 flex items-center justify-center">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-foreground text-sm truncate">{title}</p>
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", s.className)}>
            <StatusIcon className="h-3 w-3" />
            {s.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
      </div>
      {actionLabel && (
        <Button size="sm" variant="outline" onClick={onAction} className="flex-shrink-0 gap-1 h-8 text-xs">
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};
