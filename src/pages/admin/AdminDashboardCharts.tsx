import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, format, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Props {
  dateRange: DateRange;
}

interface DayCount { date: string; count: number; }
interface FeatureStat { name: string; value: number; }

const tooltipStyle = {
  fontSize: 12,
  borderRadius: "0.5rem",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
};

export default function AdminDashboardCharts({ dateRange }: Props) {
  const [userSignups, setUserSignups] = useState<DayCount[]>([]);
  const [featureStats, setFeatureStats] = useState<FeatureStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCharts = useCallback(async (from: Date, to: Date) => {
    setLoading(true);
    const fromISO = startOfDay(from).toISOString();
    const toISO = endOfDay(to).toISOString();

    const [profiles, assetUnlocks, creditTx, companyUnlocks, reportUnlocks, orgs] =
      await Promise.all([
        supabase.from("profiles").select("created_at").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("user_asset_unlocks").select("id", { count: "exact", head: true }).gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("credit_transactions").select("id", { count: "exact", head: true }).gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("user_company_unlocks").select("id", { count: "exact", head: true }).gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("user_report_unlocks").select("id", { count: "exact", head: true }).gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("organizations").select("id", { count: "exact", head: true }).gte("created_at", fromISO).lte("created_at", toISO),
      ]);

    const days = eachDayOfInterval({ start: from, end: to });
    const countMap: Record<string, number> = {};
    (profiles.data ?? []).forEach(({ created_at }) => {
      const key = format(new Date(created_at), "dd/MM");
      countMap[key] = (countMap[key] ?? 0) + 1;
    });
    setUserSignups(days.map((d) => ({ date: format(d, "dd/MM"), count: countMap[format(d, "dd/MM")] ?? 0 })));

    setFeatureStats([
      { name: "Mở khóa tài sản", value: assetUnlocks.count ?? 0 },
      { name: "Giao dịch tín dụng", value: creditTx.count ?? 0 },
      { name: "Mở khóa công ty", value: companyUnlocks.count ?? 0 },
      { name: "Mở khóa báo cáo", value: reportUnlocks.count ?? 0 },
      { name: "Đăng ký KYC", value: orgs.count ?? 0 },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (dateRange.from && dateRange.to) fetchCharts(dateRange.from, dateRange.to);
  }, [dateRange, fetchCharts]);

  const tickInterval = Math.max(1, Math.ceil(userSignups.length / 5));
  const xAxisTicks = userSignups
    .filter((_, i) => i % tickInterval === 0 || i === userSignups.length - 1)
    .map((d) => d.date);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* New users area chart */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Người dùng mới theo ngày</p>
          <p className="text-xs text-muted-foreground">Đăng ký trong khoảng đã chọn</p>
        </div>
        {loading ? (
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={userSignups} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152 60% 26%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(152 60% 26%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                ticks={xAxisTicks}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Người dùng mới"]} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(152 60% 26%)"
                strokeWidth={2}
                fill="url(#fillUsers)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Feature usage bar chart */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Hoạt động tính năng</p>
          <p className="text-xs text-muted-foreground">Lượt sử dụng trong khoảng đã chọn</p>
        </div>
        {loading ? (
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={featureStats} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Lượt"]} />
              <Bar dataKey="value" fill="hsl(152 60% 26%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
