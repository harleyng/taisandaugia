import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, CheckCircle2, Plus, X, PhoneCall } from "lucide-react";
import { AuctionCompany, mapOrgRow } from "@/lib/mockAuctionCompanies";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface CompanyTypeaheadProps {
  value: AuctionCompany | null;
  onSelect: (company: AuctionCompany | null) => void;
}

export const CompanyTypeahead = ({ value, onSelect }: CompanyTypeaheadProps) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [allCompanies, setAllCompanies] = useState<AuctionCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    const companiesFetch = fetch(
      `${SUPABASE_URL}/rest/v1/auction_organizations?select=id,name,tax_code,address,province,phone&order=name&limit=200`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    ).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ id: string; name: string; tax_code: string; address: string; province: string; phone: string }[]>;
    });

    const linkedIdsFetch = supabase
      .from("organizations")
      .select("license_info")
      .neq("kyc_status", "REJECTED")
      .then(({ data }) => {
        if (!data) return new Set<string>();
        return new Set<string>(
          data
            .map((row) => (row.license_info as Record<string, unknown>)?.auction_org_id as string | undefined)
            .filter((id): id is string => !!id)
        );
      })
      .catch(() => new Set<string>());

    Promise.all([companiesFetch, linkedIdsFetch])
      .then(([companies, linkedIds]) => {
        if (cancelled) return;
        setAllCompanies(
          companies.map((row) => mapOrgRow(row, linkedIds.has(row.id) ? row.id : null))
        );
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setLoadError(true); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, []);

  const needle = q.trim().toLowerCase();
  const results = needle.length === 0
    ? allCompanies
    : allCompanies.filter((c) =>
        c.name.toLowerCase().includes(needle) ||
        c.taxCode.toLowerCase().includes(needle) ||
        c.address.toLowerCase().includes(needle) ||
        c.province.toLowerCase().includes(needle)
      );

  if (value) {
    const isLinked = value.linkedAccountId != null;
    return (
      <div
        className={`rounded-xl border-2 p-4 space-y-2 ${
          isLinked ? "border-orange-200 bg-orange-50" : "border-primary/30 bg-primary/5"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isLinked ? "bg-orange-100" : "bg-primary/10"
              }`}
            >
              <Building2 className={`h-4 w-4 ${isLinked ? "text-orange-600" : "text-primary"}`} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground leading-tight">{value.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">MST: {value.taxCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isLinked ? (
              <Badge variant="outline" className="border-orange-300 text-orange-600 bg-orange-50 text-[10px]">
                Đã có TK
              </Badge>
            ) : (
              <Badge variant="outline" className="border-green-300 text-green-600 bg-green-50 text-[10px]">
                Sẵn sàng liên kết
              </Badge>
            )}
            <button
              onClick={() => onSelect(null)}
              className="rounded p-0.5 hover:bg-muted transition-colors"
              title="Chọn lại"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {value.address}, {value.province} · {value.phone}
        </p>

        {isLinked && (
          <Button
            variant="outline"
            size="sm"
            className="border-orange-300 text-orange-700 hover:bg-orange-100 w-full text-xs"
            onClick={() => window.open("/lien-he", "_blank")}
          >
            <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
            Liên hệ hỗ trợ
          </Button>
        )}

        {!isLinked && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Công ty sẵn sàng để liên kết</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Tìm theo tên công ty, MST hoặc địa chỉ..."
          className="pl-9"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Đang tải danh sách...</div>
            ) : loadError ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Không thể tải danh sách công ty. Vui lòng thử lại.
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {needle ? `Không có kết quả cho "${q}"` : "Chưa có công ty nào trong hệ thống"}
              </div>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 text-left border-b border-border last:border-0 transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(c);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.address}, {c.province} · MST {c.taxCode}
                    </p>
                  </div>
                  {c.linkedAccountId && (
                    <Badge
                      variant="outline"
                      className="border-orange-300 text-orange-600 text-[10px] flex-shrink-0"
                    >
                      Đã có TK
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-border p-2 flex items-center justify-between bg-muted/20">
            <p className="text-xs text-muted-foreground">Không tìm thấy công ty?</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto py-0 text-xs"
              onMouseDown={(e) => {
                e.preventDefault();
                toast.info("Tính năng đang phát triển");
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Yêu cầu bổ sung
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
