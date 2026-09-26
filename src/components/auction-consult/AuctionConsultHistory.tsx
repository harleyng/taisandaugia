import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ChevronDown, History } from "lucide-react";
import type { AuctionConsultation } from "@/types/auctionConsult";
import { AuctionConsultResult } from "./AuctionConsultResult";
import { DecisionBadge } from "./AuctionConsultDecisionBar";

/** Các phiên bản đề xuất cũ (BR-CNS-05) — mở từng bản để xem lại đủ tham số lúc đó. */
export function AuctionConsultHistory({ versions, mode }: { versions: AuctionConsultation[]; mode: "owner" | "admin" }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const old = versions.filter((v) => v.status === "superseded");
  if (old.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <History className="h-3.5 w-3.5" /> Phiên bản trước
      </p>
      <ul className="space-y-2">
        {old.map((v) => {
          const open = openId === v.id;
          return (
            <li key={v.id} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : v.id)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
              >
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="font-medium text-foreground">Phiên bản {v.version}</span>
                  <span className="text-xs text-muted-foreground">
                    · {v.code} · {v.completed_at ? format(new Date(v.completed_at), "dd/MM/yyyy", { locale: vi }) : "—"} ·{" "}
                    {v.expert_name}
                  </span>
                  <DecisionBadge decision={v.seller_decision} />
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="border-t border-border p-2">
                  <AuctionConsultResult row={v} mode={mode} compact />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
