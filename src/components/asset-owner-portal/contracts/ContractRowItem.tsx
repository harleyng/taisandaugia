import { ChevronRight, ConciergeBell, FileSignature, Handshake, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IconTile } from "@/components/asset-owner-portal/ui/IconTile";
import { formatMoneyFull } from "@/utils/money";
import { cn } from "@/lib/utils";
import type { ContractTypeKey } from "@/lib/contracts/paths";
import { CONTRACT_TONE_CLASS, type ContractListRow } from "@/lib/contracts/rows";

const TYPE_ICON: Record<ContractTypeKey, LucideIcon> = {
  "ky-gui": Handshake,
  "mua-ban": FileSignature,
  "dich-vu": ConciergeBell,
};

/** Một dòng trong menu "Hợp đồng" — cả dòng là nút mở chi tiết. */
export function ContractRowItem({ row, onOpen }: { row: ContractListRow; onOpen: (row: ContractListRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="flex w-full items-center gap-3.5 rounded-2xl bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/40"
    >
      <IconTile icon={TYPE_ICON[row.type]} tone={row.needsAction ? "warning" : "primary"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{row.code ?? "Chưa có mã"}</span>
          <span className="text-xs text-muted-foreground">{row.kindLabel}</span>
          <Badge variant="outline" className={cn("border-transparent font-medium", CONTRACT_TONE_CLASS[row.tone])}>
            {row.statusLabel}
          </Badge>
          {row.actionLabel && (
            <Badge variant="outline" className="border-warning/40 bg-warning/10 font-medium text-warning">
              {row.actionLabel}
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-foreground">{row.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[row.counterparty, row.note].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-xs text-muted-foreground">{row.valueLabel}</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {row.value != null ? formatMoneyFull(row.value) : "—"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
    </button>
  );
}
