import { useMemo, useState } from "react";
import { FileText, Loader2, Store, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import type { ShareableAsset } from "@/hooks/useShareLinks";
import { CAMPAIGN_MAX_ASSETS } from "@/lib/ownerMarketing/campaigns";
import { cn } from "@/lib/utils";

interface CampaignAssetsSectionProps {
  options: ShareableAsset[];
  isLoading: boolean;
  isError: boolean;
  /** Khoá "listing:id" / "posting:id". */
  selected: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}

const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();

/**
 * Chọn 1..20 tài sản (trong phạm vi chi nhánh của người soạn): hồ sơ số hoá đã duyệt và tin trên
 * sàn đơn vị đã nhận. Mỗi tài sản nhận một link Hồ sơ online / kênh khi chiến dịch được duyệt.
 */
export function CampaignAssetsSection({ options, isLoading, isError, selected, onChange, disabled }: CampaignAssetsSectionProps) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);
  const visible = useMemo(() => {
    const n = fold(q.trim());
    return options.filter((o) => !n || fold(`${o.title} ${o.code ?? ""} ${o.branchName ?? ""}`).includes(n));
  }, [options, q]);

  const full = selected.length >= CAMPAIGN_MAX_ASSETS;
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...selected, id] : selected.filter((x) => x !== id));

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }
  if (isError) {
    return <p className="rounded-xl bg-muted/40 px-3 py-3 text-sm text-muted-foreground">Không tải được danh sách tài sản. Tải lại trang để thử lại.</p>;
  }
  if (options.length === 0) {
    return (
      <p className="rounded-xl bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
        Chưa có tài sản nào trong phạm vi của bạn. Chiến dịch dẫn khách tới Hồ sơ online, nên chỉ chọn được hồ sơ số hoá
        đã được sàn duyệt hoặc tin đã nhận ở mục “Tài sản”.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tài sản đã chọn">
          {selected.map((id) => (
            <li
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary"
            >
              <span className="truncate">{byId.get(id)?.title ?? "Tài sản"}</span>
              {!disabled && (
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-primary/15"
                  aria-label={`Bỏ ${byId.get(id)?.title ?? "tài sản"}`}
                  onClick={() => toggle(id, false)}
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <OwnerSearchInput value={q} onValueChange={setQ} placeholder="Tìm tài sản" aria-label="Tìm tài sản" />

      <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Không có tài sản nào khớp.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((o) => {
              const checked = selected.includes(o.key);
              const sold = o.listingStatus === "SOLD_RENTED";
              const Icon = o.kind === "posting" ? FileText : Store;
              const off = disabled || sold || (!checked && full);
              return (
                <li key={o.key}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/30",
                      off && !checked && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <Checkbox checked={checked} disabled={off && !checked} onCheckedChange={(v) => toggle(o.key, v === true)} />
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{o.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[
                          o.kind === "posting" ? "Hồ sơ số hoá" : "Tin trên sàn",
                          o.code,
                          sold ? "Đã bán — không cần truyền thông" : null,
                          o.branchName,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length}/{CAMPAIGN_MAX_ASSETS} tài sản. Mỗi tài sản có link Hồ sơ online riêng trên từng kênh.
      </p>
    </div>
  );
}
