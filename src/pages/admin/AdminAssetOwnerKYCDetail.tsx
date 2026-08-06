/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronLeft, CheckCircle2, XCircle, Clock, User, Mail, Phone,
  CreditCard, FileText, Building2, Shield, RefreshCw, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ORG_TYPE_LABELS } from "@/types/asset-owner";
import type { OrgType } from "@/types/asset-owner";

// ─── Shared primitives ────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; className: string }> = {
  draft:          { label: "Nháp",       className: "bg-muted text-muted-foreground" },
  pending_review: { label: "Chờ duyệt",  className: "bg-amber-100 text-amber-800" },
  under_review:   { label: "Đang xét",   className: "bg-blue-100 text-blue-800" },
  approved:       { label: "Đã duyệt",   className: "bg-green-100 text-green-800" },
  rejected:       { label: "Từ chối",    className: "bg-red-100 text-red-800" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.className}`}>{s.label}</span>
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
      <div className="p-4">{children}</div>
    </div>
  );
}

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

function UploadStatus({ path, label, onView }: { path?: string | null; label: string; onView?: (path: string) => void }) {
  const uploaded = !!path;
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
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${uploaded ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
          {uploaded ? "Đã tải lên" : "Chưa có"}
        </span>
        {uploaded && onView && (
          <button
            onClick={() => onView(path!)}
            className="text-primary hover:text-primary/80 inline-flex items-center gap-0.5 text-xs"
          >
            <ExternalLink className="h-3 w-3" />
            Xem
          </button>
        )}
      </div>
    </div>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: vi });
}

const mockEmail = (to: string, subject: string, body: string) => {
  console.log(`\n📧 [MOCK EMAIL]\nTo: ${to}\nSubject: ${subject}\n\n${body}\n`);
  toast(`📧 Email gửi tới ${to}`, { description: subject, duration: 6000 });
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminAssetOwnerKYCDetail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const isInd = type === "ca-nhan";

  const [record, setRecord] = useState<any>(null);
  const [submitter, setSubmitter] = useState<{ name: string | null; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);

  // Dialog state
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [underReviewOpen, setUnderReviewOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAdminId(session?.user.id ?? null);
    });
  }, []);

  const fetchRecord = useCallback(async () => {
    setLoading(true);
    if (isInd) {
      const { data } = await supabase
        .from("asset_owner_kyc")
        .select("*, profiles!asset_owner_kyc_user_id_fkey(name, email)")
        .eq("id", id!)
        .maybeSingle();
      if (data) {
        const { profiles, ...rest } = data as any;
        setRecord(rest);
        setSubmitter(profiles);
      }
    } else {
      const { data } = await supabase
        .from("asset_owner_org_kyc")
        .select("*, profiles!asset_owner_org_kyc_created_by_fkey(name, email), linked_owner:asset_owners(name, address)")
        .eq("id", id!)
        .maybeSingle();
      if (data) {
        const { profiles, ...rest } = data as any;
        setRecord(rest);
        setSubmitter(profiles);
      }
    }
    setLoading(false);
  }, [id, isInd]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  // ─── Signed URL viewer ────────────────────────────────────────────────────

  const viewFile = async (path: string) => {
    const { data } = await supabase.storage.from("kyc-ekyc").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Không thể mở file");
  };

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    setProcessing(true);
    const table = isInd ? "asset_owner_kyc" : "asset_owner_org_kyc";
    const { error } = await supabase
      .from(table as any)
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: adminId })
      .eq("id", id!);

    if (error) {
      toast.error("Cập nhật thất bại");
    } else {
      if (isInd) {
        // Update profile role
        await supabase
          .from("profiles")
          .select("agent_info")
          .eq("id", record.user_id)
          .maybeSingle()
          .then(async ({ data }) => {
            const agentInfo = (data?.agent_info as any) ?? {};
            const basic = agentInfo.basic ?? {};
            await supabase
              .from("profiles")
              .update({ agent_info: { ...agentInfo, basic: { ...basic, role: "asset_owner_individual" } } })
              .eq("id", record.user_id);
          });
      }
      const name = isInd ? record.full_name : record.org_name;
      mockEmail(
        submitter?.email ?? "",
        "✅ Hồ sơ Chủ tài sản đã được phê duyệt — taisandaugia.vn",
        `Xin chào,\n\nHồ sơ xác thực Chủ tài sản "${name}" đã được phê duyệt.\n\nBạn có thể quản lý tài sản tại: https://taisandaugia.vn/profile?tab=my-assets\n\nTrân trọng,\nĐội ngũ taisandaugia.vn`,
      );
      toast.success("Đã phê duyệt hồ sơ");
      setApproveOpen(false);
      fetchRecord();
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setProcessing(true);
    const table = isInd ? "asset_owner_kyc" : "asset_owner_org_kyc";
    const updatePayload: Record<string, unknown> = {
      status: "rejected",
      rejection_reason: rejectReason.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    };
    if (!isInd && reviewNotes.trim()) updatePayload.review_notes = reviewNotes.trim();

    const { error } = await supabase
      .from(table as any)
      .update(updatePayload)
      .eq("id", id!);

    if (error) {
      toast.error("Cập nhật thất bại");
    } else {
      const name = isInd ? record.full_name : record.org_name;
      mockEmail(
        submitter?.email ?? "",
        "❌ Hồ sơ Chủ tài sản bị từ chối — taisandaugia.vn",
        `Xin chào,\n\nHồ sơ xác thực Chủ tài sản "${name}" chưa đáp ứng yêu cầu.\n\nLý do: ${rejectReason.trim()}\n\nBạn có thể nộp lại tại: https://taisandaugia.vn/tro-thanh-chu-tai-san\n\nTrân trọng,\nĐội ngũ taisandaugia.vn`,
      );
      toast.success("Đã từ chối hồ sơ");
      setRejectOpen(false);
      setRejectReason("");
      setReviewNotes("");
      fetchRecord();
    }
    setProcessing(false);
  };

  const handleMoveToUnderReview = async () => {
    setProcessing(true);
    const { error } = await supabase
      .from("asset_owner_org_kyc" as any)
      .update({ status: "under_review" })
      .eq("id", id!);
    if (error) toast.error("Cập nhật thất bại");
    else { toast.success("Chuyển sang Đang xét"); setUnderReviewOpen(false); fetchRecord(); }
    setProcessing(false);
  };

  const handleReapprove = async () => {
    setProcessing(true);
    const table = isInd ? "asset_owner_kyc" : "asset_owner_org_kyc";
    const { error } = await supabase
      .from(table as any)
      .update({ status: "pending_review", rejection_reason: null, reviewed_at: null, reviewed_by: null })
      .eq("id", id!);
    if (error) toast.error("Cập nhật thất bại");
    else { toast.success("Đã chuyển về chờ duyệt"); fetchRecord(); }
    setProcessing(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-6 py-8 flex items-center justify-center h-64 text-sm text-muted-foreground">
        Đang tải...
      </div>
    );
  }

  if (!record) {
    return (
      <div className="px-6 py-8 text-center text-sm text-muted-foreground">
        Không tìm thấy hồ sơ.
      </div>
    );
  }

  const status: string = record.status;

  return (
    <>
      <div className="px-6 py-8 space-y-6 max-w-5xl">
        {/* Back + header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate("/admin/chu-tai-san")}
              className="mt-0.5 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-foreground">
                  {isInd ? (record.full_name ?? "Cá nhân") : (record.org_name ?? "Tổ chức")}
                </h1>
                <StatusBadge status={status} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isInd ? "Hồ sơ KYC Cá nhân" : "Hồ sơ KYC Tổ chức"} ·{" "}
                Nộp {record.submitted_at ? fmtDate(record.submitted_at) : "chưa nộp"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRecord} className="gap-1.5 shrink-0">
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: sections */}
          <div className="lg:col-span-2 space-y-4">
            {isInd ? (
              <>
                {/* Section A: Personal info */}
                <SectionCard letter="A" title="Thông tin cá nhân">
                  <InfoRow icon={User} label="Họ và tên" value={record.full_name} />
                  <InfoRow icon={CreditCard} label="Loại giấy tờ" value={record.id_type === "cccd" ? "CCCD / CMND" : record.id_type === "passport" ? "Hộ chiếu" : "—"} />
                  <InfoRow icon={CreditCard} label="Số giấy tờ" value={record.id_number} />
                  <InfoRow icon={Phone} label="Điện thoại" value={
                    <span className="flex items-center gap-1.5">
                      {record.phone}
                      {record.phone_verified && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Đã xác thực</span>
                      )}
                    </span>
                  } />
                  <InfoRow icon={Mail} label="Email liên hệ" value={record.contact_email} />
                </SectionCard>

                {/* Section B: eKYC */}
                <SectionCard letter="B" title="eKYC — Ảnh giấy tờ">
                  <div className="space-y-2">
                    <UploadStatus path={record.id_front_url} label="Mặt trước CCCD / Hộ chiếu" onView={viewFile} />
                    <UploadStatus path={record.id_back_url} label="Mặt sau CCCD" onView={viewFile} />
                    <UploadStatus path={record.selfie_url} label="Selfie khuôn mặt" onView={viewFile} />
                  </div>
                </SectionCard>

                {/* Section C: Account */}
                <SectionCard letter="C" title="Tài khoản nộp hồ sơ">
                  <InfoRow icon={User} label="Tên tài khoản" value={submitter?.name} />
                  <InfoRow icon={Mail} label="Email tài khoản" value={submitter?.email} />
                  <InfoRow icon={Clock} label="Ngày nộp" value={fmtDate(record.submitted_at)} />
                  <InfoRow icon={Clock} label="Cập nhật lần cuối" value={fmtDate(record.updated_at)} />
                </SectionCard>
              </>
            ) : (
              <>
                {/* Section A: Org info */}
                <SectionCard letter="A" title="Thông tin tổ chức">
                  <InfoRow icon={Building2} label="Loại tổ chức" value={record.org_type ? ORG_TYPE_LABELS[record.org_type as OrgType] : "—"} />
                  <InfoRow icon={Building2} label="Tên tổ chức" value={record.org_name} />
                  {/* Chọn từ danh bạ = tên khớp tuyệt đối với dữ liệu tài sản trên sàn;
                      tự nhập tay thì tên có thể lệch, cần soi kỹ giấy tờ khi duyệt. */}
                  <InfoRow icon={Shield} label="Nguồn tên tổ chức" value={
                    record.linked_owner ? (
                      <span className="text-green-600 font-semibold">
                        Chọn từ danh bạ chủ tài sản
                        {record.linked_owner.address && (
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {record.linked_owner.address}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold">Người khai tự nhập</span>
                    )
                  } />
                  <InfoRow icon={CreditCard} label="Mã số thuế / Mã cơ quan" value={record.tax_code} />
                  <InfoRow icon={Mail} label="Email công vụ" value={record.official_email} />
                  <InfoRow icon={Shield} label="Domain email" value={record.email_domain} />
                  {record.registry_match_score !== null && (
                    <InfoRow icon={Shield} label="Khớp cổng quốc gia" value={
                      <span className={`font-semibold ${record.registry_match_score >= 0.8 ? "text-green-600" : "text-amber-600"}`}>
                        {Math.round(record.registry_match_score * 100)}%
                      </span>
                    } />
                  )}
                </SectionCard>

                {/* Section B: Representative */}
                <SectionCard letter="B" title="Người đại diện / Được ủy quyền">
                  <InfoRow icon={User} label="Họ và tên" value={record.rep_full_name} />
                  <InfoRow icon={User} label="Chức vụ" value={record.rep_title} />
                  <InfoRow icon={CreditCard} label="Loại giấy tờ" value={record.rep_id_type === "cccd" ? "CCCD / CMND" : record.rep_id_type === "passport" ? "Hộ chiếu" : "—"} />
                  <InfoRow icon={CreditCard} label="Số giấy tờ" value={record.rep_id_number} />
                </SectionCard>

                {/* Section C: Rep eKYC */}
                <SectionCard letter="C" title="eKYC người đại diện">
                  <div className="space-y-2">
                    <UploadStatus path={record.rep_id_front_url} label="Mặt trước CCCD người đại diện" onView={viewFile} />
                    <UploadStatus path={record.rep_id_back_url} label="Mặt sau CCCD người đại diện" onView={viewFile} />
                    <UploadStatus path={record.rep_selfie_url} label="Selfie người đại diện" onView={viewFile} />
                  </div>
                </SectionCard>

                {/* Section D: Org docs */}
                <SectionCard letter="D" title="Tài liệu pháp lý tổ chức">
                  <div className="space-y-2">
                    <UploadStatus path={record.establishment_doc_url} label="Giấy phép / Quyết định thành lập" onView={viewFile} />
                    <UploadStatus path={record.authorization_doc_url} label="Giấy ủy quyền / Quyết định bổ nhiệm" onView={viewFile} />
                  </div>
                </SectionCard>

                {/* Section E: Account */}
                <SectionCard letter="E" title="Tài khoản nộp hồ sơ">
                  <InfoRow icon={User} label="Tên tài khoản" value={submitter?.name} />
                  <InfoRow icon={Mail} label="Email tài khoản" value={submitter?.email} />
                  <InfoRow icon={Clock} label="Ngày nộp" value={fmtDate(record.submitted_at)} />
                  <InfoRow icon={Clock} label="Cập nhật lần cuối" value={fmtDate(record.updated_at)} />
                  {record.review_notes && (
                    <InfoRow icon={FileText} label="Ghi chú xét duyệt" value={record.review_notes} />
                  )}
                </SectionCard>
              </>
            )}
          </div>

          {/* Right panel: actions */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 sticky top-6">
              <h3 className="font-semibold text-foreground text-sm">Hành động xét duyệt</h3>

              {status === "pending_review" && (
                <>
                  {!isInd && (
                    <Button
                      variant="outline"
                      className="w-full gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => setUnderReviewOpen(true)}
                    >
                      <Clock className="h-4 w-4" />
                      Chuyển Đang xét
                    </Button>
                  )}
                  <Button
                    className="w-full gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setApproveOpen(true)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Phê duyệt hồ sơ
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => { setRejectOpen(true); setRejectReason(""); }}
                  >
                    <XCircle className="h-4 w-4" />
                    Từ chối hồ sơ
                  </Button>
                </>
              )}

              {status === "under_review" && (
                <>
                  <Button
                    className="w-full gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setApproveOpen(true)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Phê duyệt hồ sơ
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => { setRejectOpen(true); setRejectReason(""); }}
                  >
                    <XCircle className="h-4 w-4" />
                    Từ chối hồ sơ
                  </Button>
                </>
              )}

              {status === "approved" && (
                <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  Hồ sơ đã được phê duyệt
                </div>
              )}

              {status === "rejected" && (
                <>
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
                    <p className="text-xs font-semibold text-red-700">Lý do từ chối:</p>
                    <p className="text-xs text-red-600">{record.rejection_reason ?? "—"}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={handleReapprove}
                    disabled={processing}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Duyệt lại hồ sơ
                  </Button>
                </>
              )}

              {status === "draft" && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Hồ sơ chưa được nộp
                </p>
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
              Phê duyệt hồ sơ của{" "}
              <span className="font-semibold">{isInd ? record.full_name : record.org_name}</span>?
              {!isInd && " Hệ thống sẽ tự tạo workspace cho tổ chức này."}
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
            <DialogTitle>Từ chối hồ sơ</DialogTitle>
            <DialogDescription>
              Nhập lý do từ chối cho{" "}
              <span className="font-semibold">{isInd ? record.full_name : record.org_name}</span>.
              Lý do sẽ hiển thị cho người dùng và gửi qua email.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="VD: Ảnh CCCD không đủ rõ nét. Vui lòng chụp lại ảnh sắc nét hơn."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          {!isInd && (
            <Textarea
              placeholder="Ghi chú nội bộ (tuỳ chọn, không hiện cho user)"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={2}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectReason(""); }}>Huỷ</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing || !rejectReason.trim()}>
              <XCircle className="mr-1.5 h-4 w-4" />
              {processing ? "Đang xử lý..." : "Xác nhận từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to under_review dialog */}
      <Dialog open={underReviewOpen} onOpenChange={(o) => { if (!o) setUnderReviewOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chuyển sang Đang xét duyệt</DialogTitle>
            <DialogDescription>
              Xác nhận tiếp nhận hồ sơ của{" "}
              <span className="font-semibold">{record.org_name}</span> để xem xét chi tiết?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnderReviewOpen(false)}>Huỷ</Button>
            <Button onClick={handleMoveToUnderReview} disabled={processing}>
              <Clock className="mr-1.5 h-4 w-4" />
              {processing ? "Đang xử lý..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
