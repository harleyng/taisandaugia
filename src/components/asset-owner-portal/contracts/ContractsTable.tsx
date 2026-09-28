import { AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import type { ContractListRow } from "@/lib/contracts/rows";
import type { PostingBrief } from "@/lib/contracts/postingBrief";
import { ContractStatusPill } from "./ContractStatusPill";

interface ContractsTableProps {
  rows: ContractListRow[];
  briefOf: (row: ContractListRow) => PostingBrief | null;
  onOpen: (row: ContractListRow) => void;
}

/** "26/09" — cột Cập nhật. */
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const TH = "whitespace-nowrap border-b bg-muted/30 px-3.5 py-[11px] text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground";

/**
 * Bảng hợp đồng (design "Hop Dong - Danh sach & Chi tiet"): Hợp đồng · Tài sản · Bên kia ·
 * Giá trị · Trạng thái · Cập nhật. Dòng có việc của bạn có vạch vàng bên trái.
 */
export function ContractsTable({ rows, briefOf, onOpen }: ContractsTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className={cn(TH, "pl-[22px]")}>Hợp đồng</th>
              <th className={TH}>Tài sản</th>
              <th className={cn(TH, "hidden lg:table-cell")}>Bên kia</th>
              <th className={cn(TH, "text-right")}>Giá trị</th>
              <th className={TH}>Trạng thái</th>
              <th className={cn(TH, "hidden lg:table-cell")}>Cập nhật</th>
              <th className={cn(TH, "w-8 pr-[18px]")} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const brief = briefOf(r);
              const assetSub = [brief?.category].filter(Boolean).join(" · ");
              return (
                <tr
                  key={r.key}
                  tabIndex={0}
                  onClick={() => onOpen(r)}
                  onKeyDown={(e) => e.key === "Enter" && onOpen(r)}
                  className="group cursor-pointer border-b last:border-0 hover:bg-primary/[0.03] focus-visible:bg-primary/[0.05] focus-visible:outline-none"
                >
                  <td
                    className={cn(
                      "px-3.5 py-[13px] pl-[22px] align-middle",
                      r.needsAction && "shadow-[inset_3px_0_0_hsl(var(--warning))]",
                    )}
                  >
                    <b className="block whitespace-nowrap font-semibold text-foreground">{r.code ?? "Chưa có mã"}</b>
                    <small className="mt-0.5 block whitespace-nowrap text-xs text-muted-foreground">{r.kindLabel}</small>
                  </td>
                  <td className="max-w-[300px] px-3.5 py-[13px] align-middle">
                    <b className="block truncate font-semibold text-foreground" title={r.title}>
                      {r.title}
                    </b>
                    {(brief?.code || assetSub) && (
                      <small className="mt-0.5 block text-xs text-muted-foreground">
                        {brief?.code && (
                          <span className="rounded-[5px] bg-muted px-1.5 py-px font-mono text-[11.5px] text-foreground">
                            {brief.code}
                          </span>
                        )}
                        {brief?.code && assetSub && " · "}
                        {assetSub}
                      </small>
                    )}
                  </td>
                  <td className="hidden max-w-[220px] truncate px-3.5 py-[13px] align-middle lg:table-cell">
                    {r.counterparty ?? "—"}
                    {r.counterpartyRole && <small className="block text-xs text-muted-foreground">{r.counterpartyRole}</small>}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-[13px] text-right align-middle tabular-nums">
                    <b className="block font-semibold text-foreground">{r.value != null ? formatMoneyShort(r.value) : "—"}</b>
                    <small className="block text-xs font-normal text-muted-foreground">{r.valueLabel}</small>
                  </td>
                  <td className="px-3.5 py-[13px] align-middle">
                    <div className="flex flex-col items-start gap-1">
                      <ContractStatusPill tone={r.tone}>{r.statusLabel}</ContractStatusPill>
                      {r.actionLabel && (
                        <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-warning">
                          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                          {r.actionLabel}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-3.5 py-[13px] align-middle text-[13px] tabular-nums text-muted-foreground lg:table-cell">
                    {dayMonth(r.updatedAt)}
                  </td>
                  <td className="py-[13px] pr-[18px] align-middle text-muted-foreground/70 group-hover:text-primary">
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
