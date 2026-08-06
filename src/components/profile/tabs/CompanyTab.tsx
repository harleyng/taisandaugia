import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Building2, ArrowRight, CheckCircle2, Clock,
  FileText, XCircle, AlertCircle, LayoutDashboard,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import { useCapacityProfile } from "@/hooks/useCapacityProfile";
import type { AgentInfoShape } from "@/lib/onboardingTasks";

type AccountState = "none" | "in_progress" | "pending" | "approved_new" | "owner_active" | "rejected_new" | "rejected";

interface OrgRow {
  id: string;
  name: string;
  kyc_status: string;
  rejection_reason: string | null;
  license_info: Record<string, unknown> | null;
  updated_at: string;
}

interface CompanyData {
  id: string;           // auction_org id
  name: string;
  taxCode: string;
  province: string;
  createdAt: string;
  listingsCount: number;
}

export const CompanyTab = () => {
  const [state, setState] = useState<AccountState>("none");
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { setLoading(false); return; }

      const userId = session.user.id;

      // Không lọc owner_id nữa: RLS "Members can view their organizations" đã
      // giới hạn đúng các tổ chức user được thấy (sở hữu HOẶC thành viên ACTIVE),
      // nên thành viên được mời cũng thấy tab này. Ưu tiên tổ chức mình sở hữu để
      // giữ nguyên hành vi cũ của chủ sở hữu.
      const { data: orgRows } = await supabase
        .from("organizations")
        .select("id, name, kyc_status, rejection_reason, license_info, updated_at, owner_id")
        .order("created_at", { ascending: false });
      const orgRow =
        orgRows?.find((o) => o.owner_id === userId) ?? orgRows?.[0] ?? null;

      if (!orgRow) {
        setState("none");
        setLoading(false);
        return;
      }

      // license_info là cột JSONB (Supabase sinh kiểu `Json`); ép một lần ở đây
      // để phần dưới đọc `license_info.auction_org_id` mà không phải cast lại.
      setOrg({ ...orgRow, license_info: orgRow.license_info as Record<string, unknown> | null });

      if (orgRow.kyc_status === "NOT_APPLIED") {
        setState("in_progress");
        setLoading(false);
        return;
      }

      if (orgRow.kyc_status === "PENDING_KYC") {
        setState("pending");
        setLoading(false);
        return;
      }

      if (orgRow.kyc_status === "APPROVED" || orgRow.kyc_status === "REJECTED") {
        // Read agent_info to check if the owner has seen this result yet
        const { data: profile } = await supabase
          .from("profiles")
          .select("agent_info")
          .eq("id", userId)
          .single();

        const agentInfo = (profile?.agent_info as AgentInfoShape | null) ?? {};
        const basic = agentInfo.basic || {};
        const seen = basic.kyc_result_seen === true;

        if (orgRow.kyc_status === "APPROVED") {
          if (!seen) {
            // First visit after approval — mark seen + promote role
            setState("approved_new");
            await supabase.from("profiles").update({
              agent_info: {
                ...agentInfo,
                basic: { ...basic, role: "company", kyc_result_seen: true },
              } as never,
            }).eq("id", userId);
          } else {
            setState("owner_active");
          }

          // Fetch auction org data for the owner_active / approved_new UI
          const licenseInfo = orgRow.license_info as Record<string, unknown> | null;
          const auctionOrgId = licenseInfo?.auction_org_id as string | undefined;
          if (auctionOrgId) {
            const [orgRes, listingsRes] = await Promise.all([
              supabase
                .from("auction_organizations")
                .select("name, tax_code, province, created_at")
                .eq("id", auctionOrgId)
                .single(),
              supabase
                .from("listings")
                .select("id", { count: "exact", head: true })
                .eq("auction_org_id", auctionOrgId),
            ]);
            if (orgRes.data) {
              setCompanyData({
                id: auctionOrgId,
                name: orgRes.data.name,
                taxCode: orgRes.data.tax_code ?? "",
                province: orgRes.data.province ?? "",
                createdAt: orgRes.data.created_at,
                listingsCount: listingsRes.count ?? 0,
              });
            }
          }
        } else {
          // REJECTED
          if (!seen) {
            setState("rejected_new");
            await supabase.from("profiles").update({
              agent_info: {
                ...agentInfo,
                basic: { ...basic, kyc_result_seen: true },
              } as never,
            }).eq("id", userId);
          } else {
            setState("rejected");
          }
        }
      }

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Công ty của tôi</h2>
        <p className="text-sm text-muted-foreground">
          {(state === "owner_active" || state === "approved_new") && companyData
            ? `Quản lý vai trò Owner — ${companyData.name}`
            : "Quản lý vai trò owner công ty đấu giá"}
        </p>
      </div>

      {state === "none"         && <NoneState />}
      {state === "in_progress"  && <InProgressState org={org!} />}
      {state === "pending"      && <PendingState org={org!} />}
      {state === "approved_new" && <OwnerActiveState company={companyData} isNew />}
      {state === "owner_active" && <OwnerActiveState company={companyData} isNew={false} />}
      {state === "rejected_new" && <RejectedState org={org!} isNew />}
      {state === "rejected"     && <RejectedState org={org!} isNew={false} />}
    </div>
  );
};

/* ─── NoneState ─── */
const NoneState = () => {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-8 text-center space-y-4">
      <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <Building2 className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Bạn đại diện công ty đấu giá?</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Đăng ký để tạo hồ sơ năng lực chuyên nghiệp, sẵn sàng xuất file PDF mang đi pitching đấu thầu với chủ tài sản.
          Hồ sơ tích hợp dữ liệu đã xác thực qua Bộ Tư pháp.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
        {[
          { icon: CheckCircle2,    title: "Xác thực Bộ Tư pháp",    desc: "Thông tin pháp lý được đối chiếu, tạo độ tin cậy khi pitching" },
          { icon: FileText,        title: "Xuất PDF chuyên nghiệp",  desc: "Tải hồ sơ năng lực hoàn chỉnh chỉ với một click" },
          { icon: LayoutDashboard, title: "Quản lý tập trung",       desc: "Cập nhật thông tin, portfolio, đấu giá viên tại một nơi" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-3 space-y-1">
            <Icon className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
      <Button onClick={() => navigate("/dang-ky-to-chuc")}>
        Bắt đầu đăng ký công ty
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
      <p className="text-xs text-muted-foreground">
        Tài khoản cá nhân của bạn sẽ được gắn vai trò Owner sau khi hoàn tất xác thực.
        Quá trình xác thực mất khoảng 5–10 phút và cần Giấy ĐKDN, Giấy phép hoạt động đấu giá.
      </p>
    </div>
  );
};

/* ─── InProgressState ─── */
const InProgressState = ({ org }: { org: OrgRow }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <FileText className="h-6 w-6 text-blue-500" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-blue-900">Đang khai báo — chưa gửi hồ sơ</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Hồ sơ <span className="font-medium">{org.name || "công ty"}</span> chưa được gửi để kiểm duyệt.
            Hoàn tất và gửi để tiếp tục quá trình xác thực.
          </p>
        </div>
        <Button onClick={() => navigate("/dang-ky-to-chuc")} className="flex-shrink-0">
          Tiếp tục khai báo
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiến trình xác thực</p>
        {[
          { label: "Khai báo thông tin",       done: true,  note: "Đang thực hiện" },
          { label: "Gửi hồ sơ để kiểm duyệt", done: false, note: "Chờ bạn gửi" },
          { label: "Kiểm tra tài liệu",         done: false, note: "1–2 ngày làm việc" },
          { label: "Phê duyệt tài khoản",       done: false, note: "Sau khi xác minh" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.done ? "bg-blue-400" : "bg-border"}`} />
            <p className={`text-sm flex-1 ${item.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{item.label}</p>
            <span className="text-xs text-muted-foreground">{item.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── PendingState ─── */
const PendingState = ({ org }: { org: OrgRow }) => {
  const submittedAgo = formatDistanceToNow(new Date(org.updated_at), { addSuffix: true, locale: vi });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-col items-center text-center gap-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-7 w-7 text-amber-500" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
          </span>
        </div>
        <div>
          <p className="font-semibold text-amber-900">Đang chờ kiểm duyệt</p>
          <p className="text-sm text-amber-700 mt-0.5">
            Hồ sơ <span className="font-medium">{org.name}</span> đã gửi {submittedAgo}.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiến trình</p>
        {[
          { label: "Hồ sơ đã nhận", done: true,  time: submittedAgo },
          { label: "Kiểm tra tài liệu", done: false, time: "1–2 ngày làm việc" },
          { label: "Xác minh thông tin công ty", done: false, time: "1–2 ngày làm việc" },
          { label: "Phê duyệt tài khoản", done: false, time: "Sau khi xác minh" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.done ? "bg-green-500" : "bg-border"}`} />
            <p className={`text-sm flex-1 ${item.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{item.label}</p>
            <span className="text-xs text-muted-foreground">{item.time}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
        Chúng tôi sẽ thông báo kết quả qua email sau khi hoàn tất kiểm duyệt. Thời gian xử lý thông thường là <strong>1–3 ngày làm việc</strong>.
      </div>
    </div>
  );
};

/* ─── OwnerActiveState ─── */
const OwnerActiveState = ({ company, isNew }: { company: CompanyData | null; isNew: boolean }) => {
  const navigate = useNavigate();
  const { profile } = useCapacityProfile();
  const scorePercent = Math.round((profile.totalCapacityScore / 76) * 100);
  const verifiedDate = company?.createdAt
    ? format(new Date(company.createdAt), "dd/MM/yyyy")
    : null;

  return (
    <div className="space-y-4">
      {/* First-visit approval banner */}
      {isNew && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-900 text-sm">KYC được phê duyệt!</p>
            <p className="text-xs text-green-700 mt-0.5">
              Hồ sơ công ty đã được xác minh. Tài khoản Owner của bạn đã kích hoạt đầy đủ tính năng.
            </p>
          </div>
        </div>
      )}

      {/* Company info card — display only, no CTA */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{company?.name ?? "Đang tải..."}</p>
            {company?.taxCode && (
              <p className="text-xs text-muted-foreground mt-0.5">MST: {company.taxCode}</p>
            )}
            <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
              Đã xác thực qua Bộ Tư pháp
              {verifiedDate && <span className="text-muted-foreground">· {verifiedDate}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Portal CTA card */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
        <div>
          <p className="font-semibold text-foreground text-base">🚀 Company Portal</p>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý hồ sơ năng lực, đấu giá viên, dữ liệu kinh doanh và lập hồ sơ dự tuyển.
          </p>
        </div>

        {/* Capability progress */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Tiến độ năng lực:{" "}
            <span className="font-semibold text-foreground">
              {profile.totalCapacityScore}/76 điểm
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Progress value={scorePercent} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground w-8 text-right">
              {scorePercent}%
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => navigate("/portal")}>
            Vào Portal
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ─── RejectedState ─── */
const RejectedState = ({ org, isNew }: { org: OrgRow; isNew: boolean }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      {isNew && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900 text-sm">Hồ sơ KYC bị từ chối</p>
            <p className="text-xs text-red-700 mt-0.5">
              Kết quả kiểm duyệt vừa được cập nhật. Vui lòng xem lý do bên dưới và nộp lại.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-500" />
          <p className="font-semibold text-red-900">Hồ sơ bị từ chối</p>
        </div>
        <p className="text-sm text-red-800">
          <span className="font-medium">Lý do: </span>
          {org.rejection_reason ?? "Không có ghi chú từ ban kiểm duyệt."}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Bạn có thể nộp lại hồ sơ sau khi sửa đổi
        </p>
        <p>Kiểm tra lại giấy tờ theo lý do từ chối, sau đó bắt đầu lại quy trình đăng ký.</p>
      </div>

      <Button className="w-full" onClick={() => navigate("/dang-ky-to-chuc")}>
        Nộp lại hồ sơ
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};
