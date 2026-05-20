import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ChevronLeft, CheckCircle2, XCircle, Building2, User, Mail,
  Phone, MapPin, FileText, Calendar, Hash, Shield, UserCheck,
  CreditCard, ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

type KYCStatus = "PENDING_KYC" | "APPROVED" | "REJECTED" | "NOT_APPLIED";

interface LicenseInfo {
  auction_org_id?: string;
  representative_role?: "legal_rep" | "authorized_person" | "";
  full_name?: string;
  id_type?: "cccd" | "passport";
  id_number?: string;
  phone?: string;
  contact_email?: string;
  id_front_uploaded?: boolean;
  id_back_uploaded?: boolean;
  doc_dkdn?: boolean;
  doc_license?: boolean;
  doc_auth?: boolean;
}

interface OrgDetail {
  id: string;
  name: string;
  kyc_status: KYCStatus;
  rejection_reason: string | null;
  license_info: LicenseInfo | null;
  created_at: string;
  updated_at: string;
  profiles: { name: string | null; email: string } | null;
}

interface AuctionOrg {
  id: string;
  name: string;
  tax_code: string | null;
  province: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
}

const STATUS_LABELS: Record<KYCStatus, string> = {
  NOT_APPLIED: "Chưa đăng ký",
  PENDING_KYC: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

const STATUS_COLORS: Record<KYCStatus, string> = {
  NOT_APPLIED: "bg-muted text-muted-foreground",
  PENDING_KYC: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const ID_TYPE_LABELS: Record<string, string> = {
  cccd: "CCCD / CMND",
  passport: "Hộ chiếu",
};

const ROLE_LABELS: Record<string, string> = {
  legal_rep: "Người đại diện theo pháp luật",
  authorized_person: "Người được ủy quyền",
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground shrink-0">{label}</p>
        <p className="text-sm font-medium text-foreground text-right break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

function UploadStatus({ uploaded, label }: { uploaded?: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${uploaded ? "bg-green-50" : "bg-muted"}`}>
          {uploaded
            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
            : <FileText className="h-4 w-4 text-muted-foreground" />}
        </div>
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${uploaded ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
        {uploaded ? "Đã tải lên" : "Chưa có"}
      </span>
    </div>
  );
}

function SectionCard({ letter, title, children }: { letter: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/30">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary uppercase">
          {letter}
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4 space-y-0">{children}</div>
    </div>
  );
}

const mockEmail = (to: string, subject: string, body: string) => {
  console.log(`\n📧 [MOCK EMAIL]\nTo: ${to}\nSubject: ${subject}\n\n${body}\n`);
  toast(`📧 Email gửi tới ${to}`, { description: subject, duration: 6000 });
};

export default function AdminKYCDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [auctionOrg, setAuctionOrg] = useState<AuctionOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, kyc_status, rejection_reason, license_info, created_at, updated_at, profiles!organizations_owner_id_fkey(name, email)")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) { setNotFound(true); setLoading(false); return; }

      const orgData = data as OrgDetail;
      setOrg(orgData);

      const auctionOrgId = (orgData.license_info as LicenseInfo)?.auction_org_id;
      if (auctionOrgId) {
        const { data: aoData } = await supabase
          .from("auction_organizations")
          .select("id, name, tax_code, province, phone, address, email")
          .eq("id", auctionOrgId)
          .maybeSingle();
        if (aoData) setAuctionOrg(aoData as AuctionOrg);
      }

      setLoading(false);
    })();
  }, [id]);

  const handleApprove = async () => {
    if (!org) return;
    setProcessing(true);
    const { error } = await supabase.from("organizations").update({ kyc_status: "APPROVED" }).eq("id", org.id);
    if (error) {
      toast.error("Cập nhật thất bại");
    } else {
      mockEmail(
        org.profiles?.email ?? "",
        "✅ Hồ sơ KYC của bạn đã được phê duyệt — taisandaugia.vn",
        `Xin chào,\n\nHồ sơ KYC của công ty "${org.name}" đã được phê duyệt.\n\nTrân trọng,\nĐội ngũ taisandaugia.vn`,
      );
      toast.success("Đã duyệt hồ sơ");
      setOrg({ ...org, kyc_status: "APPROVED" });
      setApproveOpen(false);
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!org || !rejectReason.trim()) return;
    setProcessing(true);
    const { error } = await supabase
      .from("organizations")
      .update({ kyc_status: "REJECTED", rejection_reason: rejectReason.trim() })
      .eq("id", org.id);
    if (error) {
      toast.error("Cập nhật thất bại");
    } else {
      mockEmail(
        org.profiles?.email ?? "",
        "❌ Hồ sơ KYC của bạn bị từ chối — taisandaugia.vn",
        `Xin chào,\n\nHồ sơ KYC của công ty "${org.name}" chưa đáp ứng yêu cầu.\n\nLý do: ${rejectReason.trim()}\n\nTrân trọng,\nĐội ngũ taisandaugia.vn`,
      );
      toast.success("Đã từ chối hồ sơ");
      setOrg({ ...org, kyc_status: "REJECTED", rejection_reason: rejectReason.trim() });
      setRejectOpen(false);
      setRejectReason("");
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
        Không tìm thấy hồ sơ.
      </div>
    );
  }

  const li = (org.license_info ?? {}) as LicenseInfo;

  return (
    <>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Back + Header */}
        <div className="space-y-1">
          <button
            onClick={() => navigate("/admin/kyc")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Danh sách KYC
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{org.name}</h1>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[org.kyc_status]}`}>
              {STATUS_LABELS[org.kyc_status]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Nộp lúc {format(new Date(org.created_at), "HH:mm dd/MM/yyyy", { locale: vi })}
            {org.updated_at !== org.created_at && ` · Cập nhật ${format(new Date(org.updated_at), "HH:mm dd/MM/yyyy", { locale: vi })}`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
          {/* Left: all 4 KYC sections */}
          <div className="space-y-4">

            {/* Section A — Công ty đấu giá */}
            <SectionCard letter="A" title="Công ty đấu giá">
              {auctionOrg ? (
                <>
                  <InfoRow icon={Building2} label="Tên tổ chức" value={auctionOrg.name} />
                  <InfoRow icon={Hash} label="Mã số thuế" value={auctionOrg.tax_code} />
                  <InfoRow icon={MapPin} label="Tỉnh / Thành phố" value={auctionOrg.province} />
                  <InfoRow icon={Phone} label="Điện thoại" value={auctionOrg.phone} />
                  <InfoRow icon={Mail} label="Email" value={auctionOrg.email} />
                  <InfoRow icon={FileText} label="Địa chỉ" value={auctionOrg.address} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-2">Chưa có thông tin tổ chức đấu giá.</p>
              )}
            </SectionCard>

            {/* Section B — Chức danh */}
            <SectionCard letter="B" title="Chức danh người đăng ký">
              <InfoRow
                icon={li.representative_role === "authorized_person" ? UserCheck : Shield}
                label="Chức danh"
                value={li.representative_role ? ROLE_LABELS[li.representative_role] : undefined}
              />
            </SectionCard>

            {/* Section C — Định danh */}
            <SectionCard letter="C" title="Định danh người đăng ký">
              <InfoRow icon={User} label="Họ và tên" value={li.full_name} />
              <InfoRow
                icon={CreditCard}
                label="Loại giấy tờ"
                value={li.id_type ? ID_TYPE_LABELS[li.id_type] : undefined}
              />
              <InfoRow icon={Hash} label="Số giấy tờ" value={li.id_number} />
              <InfoRow icon={Phone} label="Số điện thoại" value={li.phone} />
              <InfoRow icon={Mail} label="Email liên hệ" value={li.contact_email} />
              <div className="pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Ảnh giấy tờ định danh</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${li.id_front_uploaded ? "border-green-300 bg-green-50" : "border-border bg-muted/30"}`}>
                    <ImageIcon className={`h-5 w-5 ${li.id_front_uploaded ? "text-green-600" : "text-muted-foreground"}`} />
                    <span className="text-xs text-center text-muted-foreground">Mặt trước</span>
                    <span className={`text-[11px] font-semibold ${li.id_front_uploaded ? "text-green-700" : "text-muted-foreground"}`}>
                      {li.id_front_uploaded ? "Đã tải lên" : "Chưa có"}
                    </span>
                  </div>
                  <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${li.id_back_uploaded ? "border-green-300 bg-green-50" : "border-border bg-muted/30"}`}>
                    <ImageIcon className={`h-5 w-5 ${li.id_back_uploaded ? "text-green-600" : "text-muted-foreground"}`} />
                    <span className="text-xs text-center text-muted-foreground">Mặt sau</span>
                    <span className={`text-[11px] font-semibold ${li.id_back_uploaded ? "text-green-700" : "text-muted-foreground"}`}>
                      {li.id_back_uploaded ? "Đã tải lên" : "Chưa có"}
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Section D — Giấy tờ pháp lý */}
            <SectionCard letter="D" title="Giấy tờ pháp lý">
              <div className="space-y-2 pt-1">
                <UploadStatus uploaded={li.doc_dkdn} label="Bản sao công chứng ĐKDN" />
                <UploadStatus uploaded={li.doc_license} label="Giấy phép hoạt động đấu giá tài sản" />
                {li.representative_role === "authorized_person" && (
                  <UploadStatus uploaded={li.doc_auth} label="Giấy ủy quyền (có công chứng)" />
                )}
              </div>
            </SectionCard>

            {/* Submitter meta */}
            <SectionCard letter="✉" title="Tài khoản nộp hồ sơ">
              <InfoRow icon={User} label="Họ tên tài khoản" value={org.profiles?.name} />
              <InfoRow icon={Mail} label="Email tài khoản" value={org.profiles?.email} />
              <InfoRow icon={Calendar} label="Ngày nộp" value={format(new Date(org.created_at), "dd/MM/yyyy HH:mm", { locale: vi })} />
            </SectionCard>
          </div>

          {/* Right: actions */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Xét duyệt hồ sơ</h2>

              {org.kyc_status === "PENDING_KYC" && (
                <div className="flex flex-col gap-2">
                  <Button className="bg-green-600 hover:bg-green-700 w-full gap-2" onClick={() => setApproveOpen(true)}>
                    <CheckCircle2 className="h-4 w-4" /> Phê duyệt hồ sơ
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 w-full gap-2"
                    onClick={() => { setRejectReason(""); setRejectOpen(true); }}
                  >
                    <XCircle className="h-4 w-4" /> Từ chối hồ sơ
                  </Button>
                </div>
              )}

              {org.kyc_status === "APPROVED" && (
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Hồ sơ đã được phê duyệt
                </div>
              )}

              {org.kyc_status === "REJECTED" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                    <XCircle className="h-4 w-4" /> Hồ sơ đã bị từ chối
                  </div>
                  {org.rejection_reason && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                      <p className="font-medium mb-1">Lý do:</p>
                      <p>{org.rejection_reason}</p>
                    </div>
                  )}
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 w-full gap-2" onClick={() => setApproveOpen(true)}>
                    <CheckCircle2 className="h-4 w-4" /> Duyệt lại hồ sơ
                  </Button>
                </div>
              )}

              {org.kyc_status === "NOT_APPLIED" && (
                <p className="text-sm text-muted-foreground">Chưa có hồ sơ để xét duyệt.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={(o) => { if (!o) setApproveOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận phê duyệt</DialogTitle>
            <DialogDescription>
              Phê duyệt hồ sơ KYC của <span className="font-semibold">{org.name}</span>?
              Một email thông báo sẽ được gửi tới chủ tài khoản.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Huỷ</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={processing}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {processing ? "Đang xử lý..." : "Xác nhận duyệt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={(o) => { if (!o) { setRejectOpen(false); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối hồ sơ KYC</DialogTitle>
            <DialogDescription>
              Nhập lý do từ chối cho hồ sơ <span className="font-semibold">{org.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="VD: Giấy phép hoạt động đấu giá đã hết hiệu lực. Vui lòng cung cấp bản cập nhật."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectReason(""); }}>Huỷ</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing || !rejectReason.trim()}>
              <XCircle className="mr-1.5 h-4 w-4" />
              {processing ? "Đang xử lý..." : "Xác nhận từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
