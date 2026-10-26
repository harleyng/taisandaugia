import { useMemo, useState } from "react";
import { FileStack, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { useSavePlanItemExec } from "@/hooks/useAuctionPlanProgress";
import { usePlanListingOptions, useWorkspacePostingOptions } from "@/hooks/usePlanLinkOptions";
import { normalizeAdminSearch } from "@/lib/adminUnits";
import { formatMoneyShort } from "@/utils/money";
import { cn } from "@/lib/utils";
import type { AuctionPlan, AuctionPlanItem } from "@/lib/auctionPlan/types";

export type PlanLinkKind = "posting" | "listing";

interface PlanLinkDialogProps {
  kind: PlanLinkKind | null;
  item: AuctionPlanItem;
  plan: AuctionPlan;
  onOpenChange: (open: boolean) => void;
}

const COPY: Record<PlanLinkKind, { title: string; description: string; search: string; empty: string }> = {
  posting: {
    title: "Liên kết hồ sơ số hoá",
    description:
      "Chọn hồ sơ số hoá của đơn vị cho lô đất này. Sau khi liên kết, sàn tự xác nhận các mốc chọn tổ chức, ký hợp đồng, công bố phiên và kết quả.",
    search: "Tìm hồ sơ theo tên, mã, địa chỉ…",
    empty: "Đơn vị chưa có hồ sơ số hoá nào.",
  },
  listing: {
    title: "Liên kết tin đăng",
    description: "Chọn tin đăng đã nhận của đơn vị. Kết quả phiên của tin sẽ tự cập nhật vào mục này.",
    search: "Tìm tin đăng theo tên, địa chỉ…",
    empty: "Đơn vị chưa nhận tin đăng nào trên sàn.",
  },
};

/**
 * Bộ chọn liên kết của một tài sản trong kế hoạch — dùng cho CẢ hai hành động
 * (hồ sơ số hoá / tin đăng) vì chúng chỉ khác nguồn danh sách.
 *
 * KHÔNG gợi ý theo địa chỉ: `admin_unit_resolve` chỉ suy được xã cho 22,9% hồ sơ
 * đang có (địa chỉ ba cấp trước sáp nhập) — lọc theo Trạm rồi để người dùng chọn.
 */
export function PlanLinkDialog({ kind, item, plan, onOpenChange }: PlanLinkDialogProps) {
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const postings = useWorkspacePostingOptions(plan.workspace_id, kind === "posting");
  const listings = usePlanListingOptions(plan.workspace_id, kind === "listing");
  const saveM = useSavePlanItemExec(plan);

  const rows = useMemo(() => {
    const q = normalizeAdminSearch(term);
    const base =
      kind === "posting"
        ? (postings.data ?? []).map((p) => ({
            id: p.id,
            title: p.title,
            meta: [p.code, p.address || [p.ward, p.province].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
            money: p.startingPrice,
          }))
        : (listings.data ?? []).map((l) => ({ id: l.id, title: l.title, meta: l.address ?? "", money: l.price }));
    if (!q) return base;
    return base.filter((r) => normalizeAdminSearch(`${r.title} ${r.meta}`).includes(q));
  }, [kind, term, postings.data, listings.data]);

  if (!kind) return null;
  const copy = COPY[kind];
  const loading = kind === "posting" ? postings.isLoading : listings.isLoading;
  const Icon = kind === "posting" ? FileStack : Megaphone;

  const submit = () => {
    if (!picked) return;
    saveM.mutate(
      {
        itemId: item.id,
        values: kind === "posting" ? { asset_posting_id: picked } : { listing_id: picked },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !saveM.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <OwnerSearchInput
            aria-label={copy.search}
            placeholder={copy.search}
            value={term}
            onValueChange={setTerm}
            className="w-full"
          />
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState compact icon={Icon} tone="muted" title={term ? "Không có mục nào khớp." : copy.empty} />
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(r.id)}
                    aria-pressed={picked === r.id}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                      picked === r.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.meta || "—"}
                      {r.money ? ` · ${formatMoneyShort(r.money)}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saveM.isPending} onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button disabled={saveM.isPending || !picked} onClick={submit}>
            {saveM.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Liên kết
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
