import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, MapPin, Hash, ArrowRight, PhoneCall, AlertTriangle } from "lucide-react";
import { AuctionCompany, mapOrgRow } from "@/lib/mockAuctionCompanies";
import { supabase } from "@/integrations/supabase/client";

interface Step1SelectCompanyProps {
  onNext: (company: AuctionCompany) => void;
}

export const Step1SelectCompany = ({ onNext }: Step1SelectCompanyProps) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AuctionCompany | null>(null);
  const [allCompanies, setAllCompanies] = useState<AuctionCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    supabase
      .from("auction_organizations")
      .select("id, name, tax_code, address, province, phone")
      .order("name")
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(true);
        } else {
          setAllCompanies((data ?? []).map((row) => mapOrgRow(row)));
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const needle = query.trim().toLowerCase();
  const companies = needle.length === 0
    ? allCompanies
    : allCompanies.filter((c) =>
        c.name.toLowerCase().includes(needle) ||
        c.taxCode.toLowerCase().includes(needle) ||
        c.address.toLowerCase().includes(needle) ||
        c.province.toLowerCase().includes(needle)
      );

  const isLinked = selected?.linkedAccountId != null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-base text-foreground mb-1">Chọn công ty đấu giá</h3>
        <p className="text-sm text-muted-foreground">
          Tìm kiếm theo tên công ty, địa chỉ hoặc mã số thuế.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Nhập tên công ty hoặc mã số thuế..."
          className="pl-9"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
        />
      </div>

      {/* List */}
      <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : loadError ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Không thể tải danh sách công ty. Vui lòng thử lại.
          </div>
        ) : companies.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {needle ? "Không tìm thấy công ty phù hợp" : "Chưa có công ty nào trong hệ thống"}
          </div>
        ) : (
          companies.map((company) => (
            <button
              key={company.id}
              onClick={() => setSelected(company)}
              className={`w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors flex items-start gap-3 ${
                selected?.id === company.id
                  ? "bg-primary/5 border-l-2 border-l-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex-shrink-0 flex items-center justify-center mt-0.5">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-foreground leading-tight">{company.name}</p>
                  {company.linkedAccountId && (
                    <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 bg-orange-50 px-1.5 py-0">
                      Đã đăng ký
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{company.address}, {company.province}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                  <Hash className="h-3 w-3 flex-shrink-0" />
                  <span>MST: {company.taxCode}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Blocking state if company already linked */}
      {selected && isLinked && (
        <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-orange-900">Công ty này đã được liên kết với một tài khoản khác</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Nếu bạn là đại diện hợp pháp của <strong>{selected.name}</strong>, vui lòng liên hệ bộ phận hỗ trợ để được hỗ trợ xử lý.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-800 w-full"
            onClick={() => window.open("/lien-he", "_blank")}
          >
            <PhoneCall className="mr-2 h-3.5 w-3.5" />
            Liên hệ hỗ trợ
          </Button>
        </div>
      )}

      {/* Proceed */}
      {selected && !isLinked && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Đã chọn</p>
            <p className="text-sm font-semibold text-foreground truncate">{selected.name}</p>
          </div>
          <Button size="sm" onClick={() => onNext(selected)} className="flex-shrink-0">
            Tiếp tục
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Không tìm thấy công ty của bạn? Vui lòng{" "}
        <a href="/lien-he" className="text-primary underline">liên hệ hỗ trợ</a>{" "}
        để được đăng ký mới vào hệ thống.
      </p>
    </div>
  );
};
