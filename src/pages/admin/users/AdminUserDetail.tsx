import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { groupNumber } from "@/lib/advertising/slug";
import {
  useAdminUser,
  useAdminUserTransactions,
  useAdminUserUnlocks,
} from "@/hooks/useAdminUsers";
import { accountStatus } from "@/types/adminUser";
import { UserStatusBadge } from "@/components/admin/users/UserStatusBadge";
import { UserActions } from "@/components/admin/users/UserActions";
import { GrantCreditsDialog } from "@/components/admin/users/GrantCreditsDialog";

const KYC_LABELS: Record<string, string> = {
  NOT_APPLIED: "Chưa nộp",
  PENDING_KYC: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("vi-VN");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm text-foreground min-w-0 break-words">{children}</span>
    </div>
  );
}

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user, isLoading } = useAdminUser(id);
  const { data: transactions } = useAdminUserTransactions(id);
  const { data: unlocks } = useAdminUserUnlocks(id);
  const [grantOpen, setGrantOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Không tìm thấy người dùng.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/admin/nguoi-dung")}>
          Về danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/admin/nguoi-dung")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xl font-semibold text-foreground truncate">{user.name || "Chưa đặt tên"}</h1>
            <span className="shrink-0">
              <UserStatusBadge status={accountStatus(user)} />
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <div className="shrink-0">
          <UserActions user={user} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profile info */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">Thông tin hồ sơ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2.5 gap-x-8">
            <Row label="Email">{user.email}</Row>
            <Row label="Họ tên">{user.name || "—"}</Row>
            <Row label="Vai trò">{user.isAdmin ? "Admin" : "Người dùng"}</Row>
            <Row label="Trạng thái"><UserStatusBadge status={accountStatus(user)} /></Row>
            <Row label="Kích hoạt">
              {user.activated ? (user.activated_at ? fmtDate(user.activated_at) : "Đã kích hoạt") : "Chưa kích hoạt"}
            </Row>
            <Row label="Ngày đăng ký">{fmtDate(user.created_at)}</Row>
            <Row label="KYC">{KYC_LABELS[user.kyc_status] ?? user.kyc_status}</Row>
            <Row label="Nhận email marketing">{user.notifications_enabled ? "Có" : "Không"}</Row>
          </div>
        </div>

        {/* Credit summary */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Coins className="h-4 w-4" />
              <span className="text-xs">Số dư credit</span>
            </div>
            <p className="text-3xl font-bold text-foreground mt-1">{groupNumber(user.balance)} <span className="text-lg font-medium text-muted-foreground">CR</span></p>
          </div>
          <Button className="w-full" size="sm" onClick={() => setGrantOpen(true)}>
            <Gift className="h-4 w-4 mr-1.5" /> Tặng credit
          </Button>
          <div className="border-t border-border pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Tài sản đã mở</span><span className="font-medium">{unlocks?.assets ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Công ty theo dõi</span><span className="font-medium">{unlocks?.companies ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Chủ tài sản theo dõi</span><span className="font-medium">{unlocks?.owners ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Báo cáo đã mở</span><span className="font-medium">{unlocks?.reports ?? 0}</span></div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-3">
          Lịch sử giao dịch ({transactions?.length ?? 0})
        </h2>
        {!transactions || transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có giao dịch nào.</p>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</p>
                </div>
                <span className={`text-sm font-semibold whitespace-nowrap ${t.credit_delta >= 0 ? "text-success" : "text-destructive"}`}>
                  {t.credit_delta >= 0 ? "+" : ""}{groupNumber(t.credit_delta)} CR
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <GrantCreditsDialog open={grantOpen} onOpenChange={setGrantOpen} user={user} />
    </div>
  );
}
