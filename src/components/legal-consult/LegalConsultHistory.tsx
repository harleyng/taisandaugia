import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ChevronDown, History } from "lucide-react";
import type { LegalConsultation } from "@/types/legalConsult";
import { LegalConsultResult } from "./LegalConsultResult";

/** Các phiên bản kết quả cũ (BR-CNS-03) — mở từng bản để xem lại checklist lúc đó. */
export function LegalConsultHistory({ versions }: { versions: LegalConsultation[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const old = versions.filter((v) => v.status === "superseded");
  if (old.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <History className="h-3.5 w-3.5" /> Lịch sử tư vấn
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
                <span>
                  <span className="font-medium text-foreground">Phiên bản {v.version}</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {v.code} · {v.completed_at ? format(new Date(v.completed_at), "dd/MM/yyyy", { locale: vi }) : "—"}
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="border-t border-border p-2">
                  <LegalConsultResult row={v} compact />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
