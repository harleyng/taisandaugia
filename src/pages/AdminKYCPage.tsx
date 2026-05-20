import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Building2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

type KYCStatus = "PENDING_KYC" | "APPROVED" | "REJECTED" | "NOT_APPLIED";

interface OrgRow {
  id: string;
  name: string;
  kyc_status: KYCStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  profiles: { name: string | null; email: string } | null;
}

const STATUS_LABELS: Record<KYCStatus, string> = {
  NOT_APPLIED: "Chưa đăng ký",
  PENDING_KYC: "Chờ duyệt",
  APPROVED:    "Đã duyệt",
  REJECTED:    "Từ chối",
};

const STATUS_COLORS: Record<KYCStatus, string> = {
  NOT_APPLIED: "bg-muted text-muted-foreground",
  PENDING_KYC: "bg-amber-100 text-amber-800",
  APPROVED:    "bg-green-100 text-green-800",
  REJECTED:    "bg-red-100 text-red-800",
};

type Tab = "all" | KYCStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all",         label: "Tất cả" },
  { key: "PENDING_KYC", label: "Chờ duyệt" },
  { key: "APPROVED",    label: "Đã duyệt" },
  { key: "REJECTED",    label: "Từ chối" },
];

const mockEmail = (to: string, subject: string, body: string) => {
  console.log(`\n📧 [MOCK EMAIL]\nTo: ${to}\nSubject: ${subject}\n\n${body}\n`);
  toast(`📧 Email gửi tới ${to}`, { description: subject, duration: 6000 });
};

export default function AdminKYCPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);

  // Approve dialog
  const [approveTarget, setApproveTarget] = useState<OrgRow | null>(null);

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<OrgRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, kyc_status, rejection_reason, created_at, updated_at, profiles!organizations_owner_id_fkey(name, email)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Không thể tải danh sách công ty");
    } else {
      setOrgs((data ?? []) as OrgRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setProcessing(true);
    const { error } = await supabase
      .from("organizations")
      .update({ kyc_status: "APPROVED" })
      .eq("id", approveTarget.id);

    if (error) {
      toast.error("Cập nhật thất bại");
    } else {
      const ownerEmail = approveTarget.profiles?.email ?? "unknown";
      mockEmail(
        ownerEmail,
        "✅ Hồ sơ KYC của bạn đã được phê duyệt — taisandaugia.vn",
        `Xin chào,\n\nHồ sơ KYC của công ty "${approveTarget.name}" đã được đội ngũ kiểm duyệt phê duyệt thành công.\n\nBạn có thể đăng nhập và truy cập đầy đủ tính năng tại: https://taisandaugia.vn/profile?tab=company\n\nTrân trọng,\nĐội ngũ taisandaugia.vn`,
      );
      toast.success(`Đã duyệt hồ sơ: ${approveTarget.name}`);
      setApproveTarget(null);
      fetchOrgs();
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setProcessing(true);
    const { error } = await supabase
      .from("organizations")
      .update({ kyc_status: "REJECTED", rejection_reason: rejectReason.trim() })
      .eq("id", rejectTarget.id);

    if (error) {
      toast.error("Cập nhật thất bại");
    } else {
      const ownerEmail = rejectTarget.profiles?.email ?? "unknown";
      mockEmail(
        ownerEmail,
        "❌ Hồ sơ KYC của bạn bị từ chối — taisandaugia.vn",
        `Xin chào,\n\nHồ sơ KYC của công ty "${rejectTarget.name}" chưa đáp ứng yêu cầu xác minh.\n\nLý do: ${rejectReason.trim()}\n\nBạn có thể chỉnh sửa và nộp lại hồ sơ tại: https://taisandaugia.vn/dang-ky-to-chuc\n\nTrân trọng,\nĐội ngũ taisandaugia.vn`,
      );
      toast.success(`Đã từ chối hồ sơ: ${rejectTarget.name}`);
      setRejectTarget(null);
      setRejectReason("");
      fetchOrgs();
    }
    setProcessing(false);
  };

  const filtered = tab === "all" ? orgs : orgs.filter((o) => o.kyc_status === tab);
  const countFor = (key: Tab) => key === "all" ? orgs.length : orgs.filter((o) => o.kyc_status === key).length;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Quản lý KYC Công ty</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Xem xét và phê duyệt hồ sơ đăng ký công ty đấu giá</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOrgs} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
                tab === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {label}
              <span className={[
                "text-[10px] rounded-full px-1.5 py-0.5 font-semibold",
                tab === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
              ].join(" ")}>
                {countFor(key)}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Không có hồ sơ nào</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tên công ty</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Người nộp</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ngày nộp</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trạng thái</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org, i) => (
                  <tr key={org.id} className={i < filtered.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-foreground">{org.name}</span>
                      </div>
                      {org.rejection_reason && (
                        <p className="text-[11px] text-red-600 mt-0.5 ml-6 line-clamp-1">{org.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <p>{org.profiles?.name ?? "—"}</p>
                      <p className="text-[11px]">{org.profiles?.email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(org.created_at), { addSuffix: true, locale: vi })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[org.kyc_status]}`}>
                        {STATUS_LABELS[org.kyc_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {org.kyc_status === "PENDING_KYC" && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-300 text-green-700 hover:bg-green-50 text-xs gap-1"
                            onClick={() => setApproveTarget(org)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 text-xs gap-1"
                            onClick={() => { setRejectTarget(org); setRejectReason(""); }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Từ chối
                          </Button>
                        </div>
                      )}
                      {org.kyc_status === "APPROVED" && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Đã duyệt
                        </span>
                      )}
                      {org.kyc_status === "REJECTED" && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                          <XCircle className="h-3.5 w-3.5 text-red-500" /> Đã từ chối
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Approve confirm dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => { if (!o) setApproveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận phê duyệt</DialogTitle>
            <DialogDescription>
              Phê duyệt hồ sơ KYC của <span className="font-semibold">{approveTarget?.name}</span>?
              Một email thông báo sẽ được gửi tới chủ tài khoản.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Huỷ</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={processing}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {processing ? "Đang xử lý..." : "Xác nhận duyệt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối hồ sơ KYC</DialogTitle>
            <DialogDescription>
              Nhập lý do từ chối cho hồ sơ <span className="font-semibold">{rejectTarget?.name}</span>.
              Lý do này sẽ được hiển thị cho chủ tài khoản và gửi qua email.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="VD: Giấy phép hoạt động đấu giá đã hết hiệu lực. Vui lòng cung cấp bản cập nhật."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Huỷ</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectReason.trim()}
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              {processing ? "Đang xử lý..." : "Xác nhận từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
