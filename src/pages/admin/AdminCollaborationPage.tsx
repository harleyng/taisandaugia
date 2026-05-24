import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, Handshake, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

type RegistrationStatus = "NEW" | "CONTACTED" | "REJECTED";

interface RegistrationRow {
  id: string;
  org_name: string;
  contact_name: string;
  phone: string;
  email: string;
  province: string;
  note: string | null;
  status: RegistrationStatus;
  created_at: string;
}

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  REJECTED: "Đã từ chối",
};

const STATUS_COLORS: Record<RegistrationStatus, string> = {
  NEW: "bg-amber-100 text-amber-800",
  CONTACTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

type Tab = "all" | RegistrationStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "NEW", label: "Mới" },
  { key: "CONTACTED", label: "Đã liên hệ" },
  { key: "REJECTED", label: "Đã từ chối" },
];

export default function AdminCollaborationPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partnership_registrations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Không thể tải danh sách đăng ký");
    } else {
      setRows((data ?? []) as RegistrationRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const updateStatus = async (id: string, status: RegistrationStatus) => {
    setProcessing(id);
    const { error } = await supabase
      .from("partnership_registrations")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Cập nhật thất bại");
    } else {
      toast.success(status === "CONTACTED" ? "Đã đánh dấu liên hệ" : "Đã từ chối đăng ký");
      fetchRows();
    }
    setProcessing(null);
  };

  const filtered = tab === "all" ? rows : rows.filter((r) => r.status === tab);
  const countFor = (key: Tab) =>
    key === "all" ? rows.length : rows.filter((r) => r.status === key).length;

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Đăng ký hợp tác</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Danh sách tổ chức đấu giá đăng ký hợp tác từ trang chủ
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRows} className="gap-1.5">
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
            <span
              className={[
                "text-[10px] rounded-full px-1.5 py-0.5 font-semibold",
                tab === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
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
          <div className="py-12 text-center text-sm text-muted-foreground">Không có đăng ký nào</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tổ chức</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Người liên hệ</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tỉnh / Thành</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ghi chú</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ngày gửi</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trạng thái</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.id} className={i < filtered.length - 1 ? "border-b border-border" : ""}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Handshake className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-foreground">{row.org_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p>{row.contact_name}</p>
                    <p className="text-[11px]">{row.phone}</p>
                    <p className="text-[11px]">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.province}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[180px]">
                    {row.note
                      ? <span className="text-sm line-clamp-2">{row.note}</span>
                      : <span className="text-[11px] italic opacity-40">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: vi })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[row.status]}`}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === "NEW" && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-300 text-green-700 hover:bg-green-50 text-xs gap-1"
                          disabled={processing === row.id}
                          onClick={() => updateStatus(row.id, "CONTACTED")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đã liên hệ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50 text-xs gap-1"
                          disabled={processing === row.id}
                          onClick={() => updateStatus(row.id, "REJECTED")}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Từ chối
                        </Button>
                      </div>
                    )}
                    {row.status === "CONTACTED" && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Đã liên hệ
                      </span>
                    )}
                    {row.status === "REJECTED" && (
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
  );
}
