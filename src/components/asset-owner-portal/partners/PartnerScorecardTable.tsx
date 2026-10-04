import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DossierKind } from "@/lib/dossier/types";
import {
  PARTNER_METRICS,
  hasEnoughData,
  metricText,
  type PartnerScore,
} from "@/lib/dossier/partnerScorecard";

// Lớp Tailwind phải là chuỗi nguyên văn ⇒ một bản theo số chỉ số của từng loại (tên + 2 cột đếm + chỉ số).
const GRID: Record<DossierKind, string> = {
  appraisal: "md:grid md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_1rem] md:items-center md:gap-4",
  legal: "md:grid md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_1rem] md:items-center md:gap-4",
  authentication: "md:grid md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_1rem] md:items-center md:gap-4",
  auction: "md:grid md:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))_1rem] md:items-center md:gap-4",
};

interface Props {
  kind: DossierKind;
  partners: PartnerScore[];
  onSelect: (partner: PartnerScore) => void;
}

/** Bảng đối tác của một loại; bấm dòng mở danh sách tài sản của đối tác đó. */
export function PartnerScorecardTable({ kind, partners, onSelect }: Props) {
  const metrics = PARTNER_METRICS[kind];
  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID[kind])}>
        <span>Đối tác</span>
        <span className="text-right">Tài sản</span>
        <span className="text-right">Có kết quả</span>
        {metrics.map((m) => (
          <span key={m.label} className="text-right">
            {m.label}
          </span>
        ))}
        <span aria-hidden="true" />
      </div>
      <ul className="divide-y">
        {partners.map((p) => {
          const enough = hasEnoughData(p);
          return (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => onSelect(p)}
                aria-label={`Xem tài sản của ${p.name}`}
                className={cn(
                  "grid w-full grid-cols-2 gap-x-4 gap-y-1 rounded-lg py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-1",
                  GRID[kind],
                )}
              >
                <span className="col-span-2 min-w-0 md:col-span-1">
                  <span className="block truncate font-medium text-foreground">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.orgId ? "Trong danh bạ tổ chức" : "Tên tự nhập"}
                  </span>
                </span>
                <Cell label="Tài sản">{p.assets.toLocaleString("en-US")}</Cell>
                <Cell label="Có kết quả">{p.assetsWithOutcome.toLocaleString("en-US")}</Cell>
                {metrics.map((m) => (
                  <Cell key={m.label} label={m.label} muted={!enough}>
                    {metricText(p, m)}
                  </Cell>
                ))}
                <ChevronRight
                  className="hidden h-4 w-4 text-muted-foreground md:block"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Cell({ label, muted, children }: { label: string; muted?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "block tabular-nums md:text-right",
        muted ? "text-xs text-muted-foreground md:text-xs" : "text-foreground",
      )}
    >
      <span className="block text-xs font-normal text-muted-foreground md:hidden">{label}</span>
      {children}
    </span>
  );
}
