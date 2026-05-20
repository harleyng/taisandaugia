import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MilestoneProgress } from "@/components/company-onboarding/MilestoneProgress";
import {
  Building2, ArrowRight, CheckCircle2,
  LayoutDashboard, FileText, Users, Star, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AccountState = "none" | "owner_active";

const STATE_LABELS: Record<AccountState, string> = {
  none: "Cá nhân (chưa có công ty)",
  owner_active: "Owner — đã kích hoạt",
};

const MOCK_COMPANY = {
  name: "Công ty Đấu giá Hợp danh Nam Việt",
  taxCode: "0314567890",
  province: "TP. Hồ Chí Minh",
};

const UNLOCKED_FEATURES = [
  { icon: FileText, label: "Đăng và quản lý phiên đấu giá" },
  { icon: Users, label: "Quản lý hồ sơ người tham gia" },
  { icon: LayoutDashboard, label: "Dashboard phân tích công ty" },
  { icon: Star, label: "Trang hồ sơ năng lực công ty" },
];

const MILESTONE_MAP: Record<AccountState, { ms: 1 | "complete"; mode: "onboarding" | "profile" }> = {
  none:        { ms: 1,          mode: "profile" },
  owner_active: { ms: "complete", mode: "onboarding" },
};

export const CompanyTab = () => {
  const [state, setState] = useState<AccountState>("none");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("agent_info")
        .eq("id", session.user.id)
        .single();
      const agentInfo = data?.agent_info as any;
      if (agentInfo?.basic?.role === "company") setState("owner_active");
    });
  }, []);

  const { ms, mode } = MILESTONE_MAP[state];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Công ty của tôi</h2>
          <p className="text-sm text-muted-foreground">Quản lý vai trò owner công ty đấu giá</p>
        </div>

        {/* Demo state switcher */}
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
      {state === "owner_active" && <OwnerActiveState />}
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
      <p className="font-semibold text-foreground">Chưa có công ty liên kết</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        Đăng ký công ty đấu giá để mở khóa tính năng quản lý phiên đấu giá, hồ sơ năng lực và dashboard phân tích.
      </p>
    </div>
    <div className="flex flex-col sm:flex-row gap-2 justify-center">
      <Button asChild>
        <Link to="/dang-ky-to-chuc">
          Bắt đầu đăng ký công ty
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/lien-he">Tìm hiểu thêm</Link>
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      Tài khoản cá nhân của bạn sẽ được gắn vai trò "Owner" sau khi hoàn tất đăng ký.
    </p>
  </div>
);

/* ─── State: owner_active ─── */
const OwnerActiveState = () => (
  <div className="space-y-4">
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
      <div>
        <p className="font-semibold text-green-900 text-sm">Tài khoản công ty đã kích hoạt</p>
        <p className="text-xs text-green-700">Bạn có đầy đủ quyền quản lý {MOCK_COMPANY.name}.</p>
      </div>
    </div>

    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{MOCK_COMPANY.name}</p>
        <Badge className="text-[10px] bg-green-500">Đã kích hoạt</Badge>
      </div>
      <p className="text-xs text-muted-foreground">MST: {MOCK_COMPANY.taxCode} · {MOCK_COMPANY.province}</p>
    </div>

    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tính năng đã mở khóa</p>
      {UNLOCKED_FEATURES.map(({ icon: Icon, label }, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Icon className="h-3.5 w-3.5 text-green-600" />
          </div>
          <p className="text-sm text-foreground">{label}</p>
          <CheckCircle2 className="ml-auto h-4 w-4 text-green-500 flex-shrink-0" />
        </div>
      ))}
    </div>

    <Button asChild className="w-full">
      <Link to="/auction-org/cty-001">
        <Star className="mr-2 h-4 w-4" />
        Xem hồ sơ năng lực công ty
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  </div>
);
