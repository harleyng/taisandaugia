import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Building2, Landmark, CreditCard,
  ClipboardCheck, Handshake, MessageSquare, ArrowRight, CalendarIcon,
} from "lucide-react";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { vi } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AdminDashboardCharts from "./AdminDashboardCharts";

interface PeriodStats {
  newUsers: number;
  newKYC: number;
  newAuctionOrgs: number;
  creditTransactions: number;
}

interface JobStats {
  pendingKYC: number;
  newPartnerships: number;
  unreadContacts: number;
}

const PRESETS = [
  { label: "7 ngày", days: 7 },
  { label: "28 ngày", days: 28 },
  { label: "90 ngày", days: 90 },
];

const SKELETON = "rounded-xl border border-border bg-card animate-pulse";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 27),
    to: new Date(),
  });
  const [activePreset, setActivePreset] = useState(28);
  const [calOpen, setCalOpen] = useState(false);

  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [periodLoading, setPeriodLoading] = useState(true);
  const [jobLoading, setJobLoading] = useState(true);

  // Jobs to be done — always live, no date filter
  useEffect(() => {
    (async () => {
      const [pending, newPartner, unread] = await Promise.all([
        supabase.from("organizations").select("id", { count: "exact", head: true }).eq("kyc_status", "PENDING_KYC"),
        supabase.from("partnership_registrations").select("id", { count: "exact", head: true }).eq("status", "NEW"),
        supabase.from("contact_submissions").select("id", { count: "exact", head: true }).eq("status", "unread"),
      ]);
      setJobStats({
        pendingKYC: pending.count ?? 0,
        newPartnerships: newPartner.count ?? 0,
        unreadContacts: unread.count ?? 0,
      });
      setJobLoading(false);
    })();
  }, []);

  // Period stats — refetch on date range change
  const fetchPeriodStats = useCallback(async (from: Date, to: Date) => {
    setPeriodLoading(true);
    const fromISO = startOfDay(from).toISOString();
    const toISO = endOfDay(to).toISOString();

    const [newUsers, newKYC, newAuctionOrgs, creditTx] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", fromISO).lte("created_at", toISO),
      supabase.from("organizations").select("id", { count: "exact", head: true }).gte("created_at", fromISO).lte("created_at", toISO),
      supabase.from("auction_organizations").select("id", { count: "exact", head: true }).gte("created_at", fromISO).lte("created_at", toISO),
      supabase.from("credit_transactions").select("id", { count: "exact", head: true }).gte("created_at", fromISO).lte("created_at", toISO),
    ]);

    setPeriodStats({
      newUsers: newUsers.count ?? 0,
      newKYC: newKYC.count ?? 0,
      newAuctionOrgs: newAuctionOrgs.count ?? 0,
      creditTransactions: creditTx.count ?? 0,
    });
    setPeriodLoading(false);
  }, []);

  useEffect(() => {
    if (dateRange.from && dateRange.to) fetchPeriodStats(dateRange.from, dateRange.to);
  }, [dateRange, fetchPeriodStats]);

  const applyPreset = (days: number) => {
    setActivePreset(days);
    setDateRange({ from: subDays(new Date(), days - 1), to: new Date() });
  };

  const handleCalendarSelect = (r: DateRange | undefined) => {
    if (!r) return;
    setDateRange(r);
    setActivePreset(0);
    if (r.from && r.to) setCalOpen(false);
  };

  const isCustom = activePreset === 0;
  const customLabel =
    isCustom && dateRange.from && dateRange.to
      ? `${format(dateRange.from, "dd/MM/yyyy")} – ${format(dateRange.to, "dd/MM/yyyy")}`
      : "Tùy chọn";

  const statCards = periodStats
    ? [
        { label: "Người dùng mới", value: periodStats.newUsers, icon: Users, color: "text-primary bg-primary/10", border: "border-primary/20" },
        { label: "Hồ sơ KYC nộp", value: periodStats.newKYC, icon: ClipboardCheck, color: "text-amber-600 bg-amber-50", border: "border-amber-200" },
        { label: "Tổ chức đấu giá mới", value: periodStats.newAuctionOrgs, icon: Landmark, color: "text-green-600 bg-green-50", border: "border-green-200" },
        { label: "Giao dịch tín dụng", value: periodStats.creditTransactions, icon: CreditCard, color: "text-purple-600 bg-purple-50", border: "border-purple-200" },
      ]
    : [];

  const jobCards = [
    {
      key: "kyc",
      label: "KYC chờ duyệt",
      desc: "Hồ sơ tổ chức chờ xem xét",
      icon: ClipboardCheck,
      iconBg: "bg-amber-50 text-amber-600",
      count: jobStats?.pendingKYC,
      countLabel: "chờ duyệt",
      countColor: "text-amber-600",
      path: "/admin/kyc",
    },
    {
      key: "partner",
      label: "Đăng ký hợp tác",
      desc: "Tổ chức đấu giá chờ liên hệ",
      icon: Handshake,
      iconBg: "bg-orange-50 text-orange-600",
      count: jobStats?.newPartnerships,
      countLabel: "mới chưa xử lý",
      countColor: "text-orange-600",
      path: "/admin/lien-he-hop-tac?loai=hop-tac",
    },
    {
      key: "contact",
      label: "Tin nhắn liên hệ",
      desc: "Tin nhắn từ trang Liên hệ",
      icon: MessageSquare,
      iconBg: "bg-blue-50 text-blue-600",
      count: jobStats?.unreadContacts,
      countLabel: "chưa đọc",
      countColor: "text-blue-600",
      path: "/admin/lien-he-hop-tac",
    },
  ];

  return (
    <div className="px-6 py-8 space-y-10">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Tổng quan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Thống kê hệ thống Tài Sản Đấu Giá</p>
      </div>

      {/* ── SECTION 1: Thống kê ─────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Thống kê theo kỳ</h2>
            <p className="text-xs text-muted-foreground">Áp dụng cho thống kê và biểu đồ bên dưới</p>
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => applyPreset(days)}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  activePreset === days
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    isCustom
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {customLabel}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleCalendarSelect}
                  disabled={{ after: new Date() }}
                  locale={vi}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Stat cards */}
        {periodLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className={`${SKELETON} p-5 h-28`} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map(({ label, value, icon: Icon, color, border }) => (
              <div key={label} className={`rounded-xl border ${border} bg-card p-5 space-y-3`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{value.toLocaleString("vi-VN")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        <AdminDashboardCharts dateRange={dateRange} />
      </section>

      {/* ── SECTION 2: Việc cần làm ─────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Việc cần làm</h2>
          <p className="text-xs text-muted-foreground">Các mục đang chờ xử lý ngay bây giờ</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {jobCards.map(({ key, label, desc, icon: Icon, iconBg, count, countLabel, countColor, path }) => (
            <button
              key={key}
              onClick={() => navigate(path)}
              className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0" />
              </div>
              {jobLoading ? (
                <div className="mt-4 h-8 rounded-lg bg-muted animate-pulse" />
              ) : (
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-3xl font-bold text-foreground">
                    {count?.toLocaleString("vi-VN")}
                  </span>
                  <span className={`text-sm font-medium pb-0.5 ${countColor}`}>{countLabel}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
