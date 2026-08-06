import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, CheckCircle2, X, Loader2, PenLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OWNER_KIND_LABELS, type RegistryAssetOwner } from "@/types/asset-owner";

interface Props {
  /** Chủ tài sản đã chọn trong danh bạ. null = chưa chọn hoặc đang tự nhập tay. */
  value: RegistryAssetOwner | null;
  onSelect: (owner: RegistryAssetOwner) => void;
  onClear: () => void;
  /** Chuyển sang ô nhập tay khi tổ chức chưa có trong danh bạ. */
  onManual: () => void;
}

/**
 * Chọn tổ chức từ danh bạ chủ tài sản (public.asset_owners) — bản tương ứng của
 * CompanyTypeahead ở KYC công ty đấu giá.
 *
 * Chọn đúng entity trong danh bạ khiến org_name khớp tuyệt đối với dữ liệu tài
 * sản trên sàn, nên sau khi hồ sơ được duyệt run_workspace_match() gán tài sản
 * về danh mục ở mức auto_claimed thay vì bắt xác nhận tay.
 *
 * Chỉ liệt kê pháp nhân: bản ghi owner_kind = 'individual' là chủ tài sản cá
 * nhân, thuộc nhánh KYC Cá nhân chứ không phải nhánh Tổ chức.
 */
export const AssetOwnerTypeahead = ({ value, onSelect, onClear, onManual }: Props) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<RegistryAssetOwner[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Tìm phía server + debounce: danh bạ phình theo số tài sản trên sàn nên không
  // kéo hết về trình duyệt rồi lọc ở client.
  useEffect(() => {
    if (value) return;
    let cancelled = false;
    const needle = q.trim();

    const t = setTimeout(async () => {
      setLoading(true);
      setLoadError(false);
      let query = supabase
        .from("asset_owners")
        .select("id, name, address, owner_kind, aliases")
        .or("owner_kind.is.null,owner_kind.neq.individual")
        .order("name")
        .limit(20);
      if (needle.length > 0) query = query.ilike("name", `%${needle}%`);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setLoadError(true);
        setResults([]);
      } else {
        setResults((data ?? []) as RegistryAssetOwner[]);
      }
      setLoading(false);
    }, 300);

    return () => { cancelled = true; clearTimeout(t); };
  }, [q, value]);

  if (value) {
    return (
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground leading-tight">{value.name}</p>
              {value.address && (
                <p className="text-xs text-muted-foreground mt-0.5">{value.address}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {value.owner_kind && OWNER_KIND_LABELS[value.owner_kind] && (
              <Badge variant="outline" className="text-[10px]">
                {OWNER_KIND_LABELS[value.owner_kind]}
              </Badge>
            )}
            <button
              type="button"
              onClick={onClear}
              className="rounded p-0.5 hover:bg-muted transition-colors"
              title="Chọn lại"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Đã khớp với danh bạ chủ tài sản trên sàn</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Tìm theo tên tổ chức, ngân hàng, cơ quan..."
          className="pl-9"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tìm...
              </div>
            ) : loadError ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Không thể tải danh bạ chủ tài sản. Vui lòng thử lại.
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {q.trim() ? `Không có kết quả cho "${q}"` : "Chưa có chủ tài sản nào trong danh bạ"}
              </div>
            ) : (
              results.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 text-left border-b border-border last:border-0 transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(o);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{o.name}</p>
                    {o.address && (
                      <p className="text-xs text-muted-foreground truncate">{o.address}</p>
                    )}
                  </div>
                  {o.owner_kind && OWNER_KIND_LABELS[o.owner_kind] && (
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                      {OWNER_KIND_LABELS[o.owner_kind]}
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Danh bạ dựng từ tài sản đã lên sàn nên chưa phủ hết pháp nhân — không
              có lối thoát này thì tổ chức mới sẽ không nộp được hồ sơ. */}
          <div className="border-t border-border p-2 flex items-center justify-between gap-2 bg-muted/20">
            <p className="text-xs text-muted-foreground">Không tìm thấy tổ chức?</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto py-0 text-xs"
              onMouseDown={(e) => { e.preventDefault(); onManual(); setOpen(false); }}
            >
              <PenLine className="h-3 w-3 mr-1" />
              Nhập tên thủ công
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
