import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MilestoneProgress } from "@/components/company-onboarding/MilestoneProgress";
import {
  Building2, ArrowRight, CheckCircle2,
  LayoutDashboard, FileText, Users, Star, ChevronDown, Download, Edit,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

type AccountState = "none" | "owner_active";

interface CompanyData {
  id: string;
  name: string;
  taxCode: string;
  province: string;
  createdAt: string;
  listingsCount: number;
}

const STATE_LABELS: Record<AccountState, string> = {
  none: "Cá nhân (chưa có công ty)",
  owner_active: "Owner — đã kích hoạt",
};

const MILESTONE_MAP: Record<AccountState, { ms: 1 | "complete"; mode: "onboarding" | "profile" }> = {
  none:         { ms: 1,          mode: "profile" },
  owner_active: { ms: "complete", mode: "onboarding" },
};

export const CompanyTab = () => {
  const [state, setState] = useState<AccountState>("none");
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("agent_info")
        .eq("id", session.user.id)
        .single();
      const agentInfo = data?.agent_info as any;
      if (agentInfo?.basic?.role === "company") {
        setState("owner_active");
        const auctionOrgId = agentInfo?.basic?.auction_org_id as string | undefined;
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
      }
    });
  }, []);

  const { ms, mode } = MILESTONE_MAP[state];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Công ty của tôi</h2>
          <p className="text-sm text-muted-foreground">
            {state === "owner_active" && companyData
              ? `Quản lý vai trò Owner — ${companyData.name}`
              : "Quản lý vai trò owner công ty đấu giá"}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-dashed">
              <span className="hidden sm:inline text-muted-foreground">Demo:</span>
              {STATE_LABELS[state]}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(STATE_LABELS) as AccountState[]).map((s) => (
              <DropdownMenuItem key={s} onClick={() => setState(s)} className={state === s ? "font-semibold" : ""}>
                {STATE_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Milestone progress */}
      <MilestoneProgress currentMilestone={ms} mode={mode} />

      {/* State-specific content */}
      {state === "none" && <NoneState />}
      {state === "owner_active" && <OwnerActiveState company={companyData} />}
    </div>
  );
};

/* ─── State: none ─── */
const NoneState = () => (
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
        { icon: CheckCircle2, title: "Xác thực Bộ Tư pháp", desc: "Thông tin pháp lý được đối chiếu, tạo độ tin cậy khi pitching" },
        { icon: FileText,     title: "Xuất PDF chuyên nghiệp", desc: "Tải hồ sơ năng lực hoàn chỉnh chỉ với một click" },
        { icon: LayoutDashboard, title: "Quản lý tập trung", desc: "Cập nhật thông tin, portfolio, đấu giá viên tại một nơi" },
      ].map(({ icon: Icon, title, desc }) => (
        <div key={title} className="rounded-xl border border-border bg-card p-3 space-y-1">
          <Icon className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{desc}</p>
        </div>
      ))}
    </div>
    <Button asChild>
      <Link to="/dang-ky-to-chuc">
        Bắt đầu đăng ký công ty
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
    <p className="text-xs text-muted-foreground">
      Tài khoản cá nhân của bạn sẽ được gắn vai trò Owner sau khi hoàn tất xác thực.
      Quá trình xác thực mất khoảng 5–10 phút và cần Giấy ĐKDN, Giấy phép hoạt động đấu giá.
    </p>
  </div>
);

/* ─── State: owner_active ─── */
const OwnerActiveState = ({ company }: { company: CompanyData | null }) => {
  const lastUpdated = company?.createdAt
    ? formatDistanceToNow(new Date(company.createdAt), { addSuffix: true, locale: vi })
    : "—";

  return (
    <div className="space-y-4">
      {/* Company header card */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">
            {company?.name ?? "Đang tải..."}
          </p>
          <p className="text-xs text-muted-foreground">
            {company?.taxCode ? `MST: ${company.taxCode}` : ""}
            {company?.taxCode && company?.province ? " · " : ""}
            {company?.province ?? ""}
          </p>
        </div>
        <Badge className="text-[10px] bg-green-500 flex-shrink-0 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Đã xác thực qua Bộ Tư pháp
        </Badge>
      </div>

      {/* Hồ sơ năng lực section */}
      <div className="rounded-xl border border-border bg-card p-5 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tính năng dành cho công ty đã xác thực
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground">Hồ sơ năng lực công ty</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Hồ sơ năng lực chuyên nghiệp giúp công ty giới thiệu kinh nghiệm, portfolio phiên đấu giá và đội ngũ đấu giá viên tới chủ tài sản.
              Tích hợp dữ liệu đã xác thực qua Bộ Tư pháp, sẵn sàng xuất file PDF mang đi pitching đấu thầu.
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Phiên đấu giá", value: company ? String(company.listingsCount) : "—", unit: "phiên" },
              { label: "Đấu giá viên",  value: "—",  unit: "người" },
              { label: "Cập nhật lần cuối", value: lastUpdated, unit: "" },
            ].map(({ label, value, unit }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-base font-bold text-foreground mt-0.5">
                  {value}{unit ? <span className="text-sm font-normal text-muted-foreground"> {unit}</span> : null}
                </p>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link to={company ? `/auction-org/${company.id}` : "#"}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Chỉnh sửa hồ sơ
              </Link>
            </Button>
            <Button size="sm" variant="outline" disabled>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Tải file PDF
            </Button>
          </div>
        </div>

        {/* PDF preview placeholder */}
        <div className="hidden lg:flex flex-col rounded-lg border border-border bg-muted/30 overflow-hidden text-[9px]">
          <div className="bg-[#1a1a2e] text-white px-3 py-2 flex-shrink-0">
            <p className="font-bold text-[10px] text-red-400 tracking-widest">HỒ SƠ NĂNG LỰC</p>
            <p className="font-semibold text-white truncate mt-0.5">{company?.name ?? ""}</p>
          </div>
          <div className="p-3 space-y-2 flex-1">
            <div>
              <p className="font-bold text-[8px] text-muted-foreground uppercase tracking-wider">Tổng quan nhanh</p>
              {[
                { k: "Kinh nghiệm", v: "—" },
                { k: "Số phiên đã thực hiện", v: company ? String(company.listingsCount) : "—" },
                { k: "Đấu giá viên", v: "—" },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between border-b border-border/50 py-0.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-bold text-[8px] text-muted-foreground uppercase tracking-wider">Định danh pháp lý</p>
              {[
                { k: company?.taxCode ?? "MST", v: "✓" },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between border-b border-border/50 py-0.5">
                  <span className="text-muted-foreground truncate">{k}</span>
                  <span className="font-medium text-green-600">{v}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-bold text-[8px] text-muted-foreground uppercase tracking-wider">Hình ảnh năng lực</p>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <div className="h-10 rounded bg-muted" />
                <div className="h-10 rounded bg-muted" />
              </div>
            </div>
          </div>
          <div className="px-3 py-1.5 border-t border-border text-right text-muted-foreground">6 trang · A4</div>
        </div>
      </div>

      {/* Coming soon row */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold text-yellow-600">SẮP CÓ</span>
        {["Đăng phiên đấu giá", "Quản lý đấu giá viên", "Dashboard phân tích"].map((f) => (
          <span key={f} className="before:content-['·'] before:mr-3">{f}</span>
        ))}
      </div>
    </div>
  );
};
