import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Check, Download, Minus, Signature, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { cn } from "@/lib/utils";
import { openLegalDoc } from "@/hooks/useLegalConsultations";
import type { AssetPosting } from "@/types/asset-posting";
import { CardAux, SubLabel } from "./detailParts";

type Verdict = "ok" | "bad" | "unknown";

/** Câu hỏi "có vướng không": Không = tốt, Có = vướng, chưa trả lời = chưa rõ. */
const flag = (b: boolean | null): { v: string; tone: Verdict } =>
  b === null ? { v: "—", tone: "unknown" } : b ? { v: "Có", tone: "bad" } : { v: "Không", tone: "ok" };

const ICON: Record<Verdict, { icon: typeof Check; cls: string }> = {
  ok: { icon: Check, cls: "bg-success/10 text-success" },
  bad: { icon: X, cls: "bg-destructive/10 text-destructive" },
  unknown: { icon: Minus, cls: "bg-muted text-muted-foreground" },
};

const extOf = (path: string) => (path.includes(".") ? path.split(".").pop()!.toUpperCase().slice(0, 4) : "TỆP");
const idOf = (path: string) => (path.split("/").pop() ?? path).split(".")[0].slice(0, 8);

/** "Pháp lý & hiện trạng": 4 câu tự khai, bản cam kết điện tử, giấy tờ đính kèm (mở qua signed URL). */
export function PostingLegalStatusCard({ posting: p }: { posting: AssetPosting }) {
  const checks: { q: string; v: string; tone: Verdict }[] = [
    { q: "Quyền được bán", v: p.right_to_sell ? "Có" : "Chưa xác nhận", tone: p.right_to_sell ? "ok" : "unknown" },
    { q: "Đang tranh chấp", ...flag(p.has_dispute) },
    { q: "Đang thế chấp", ...flag(p.has_mortgage) },
    { q: "Bị kê biên", ...flag(p.is_seized) },
  ];
  const docs = [
    ...(p.ownership_proof_urls ?? []).map((path, i) => ({ path, name: `Giấy tờ sở hữu ${i + 1}` })),
    ...(p.doc_urls ?? []).map((path, i) => ({ path, name: `Tài liệu bổ sung ${i + 1}` })),
  ];
  const decl = p.ownership_declaration;

  return (
    <SectionCard title="Pháp lý & hiện trạng" actions={<CardAux>Chủ tài sản tự khai</CardAux>}>
      <div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {checks.map((c) => {
            const { icon: Icon, cls } = ICON[c.tone];
            return (
              <li
                key={c.q}
                className="flex items-center gap-2.5 rounded-[9px] border border-border px-3 py-2.5 text-[13.5px]"
              >
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full", cls)} aria-hidden="true">
                  <Icon className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="flex-1 text-foreground/70">{c.q}</span>
                <b className="font-semibold text-foreground">{c.v}</b>
              </li>
            );
          })}
        </ul>

        {p.legal_notes && (
          <p className="mt-3 text-[13px] text-foreground/70">
            <span className="font-semibold text-foreground">Ghi chú: </span>
            {p.legal_notes}
          </p>
        )}

        {decl && (
          <div className="mt-3 flex items-center gap-3 rounded-[9px] bg-muted/60 px-3.5 py-[11px] text-[13px] text-foreground/70">
            <Signature className="h-[18px] w-[18px] shrink-0 text-primary" aria-hidden="true" />
            <span>
              <b className="font-semibold text-foreground">Đã ký cam kết sở hữu điện tử</b> · {decl.name} ·{" "}
              {format(new Date(decl.accepted_at), "HH:mm, dd/MM/yyyy", { locale: vi })} · bản {decl.version}
            </span>
          </div>
        )}

        {docs.length > 0 && (
          <>
            <div className="my-[18px] h-px bg-border" />
            <SubLabel>Giấy tờ đính kèm · {docs.length}</SubLabel>
            <ul className="flex flex-col">
              {docs.map((d) => (
                <li key={d.path} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
                  <span
                    className="grid h-[38px] w-8 shrink-0 place-items-end justify-center rounded-[5px] border border-border bg-muted/60 pb-[5px] font-mono text-[8px] font-semibold text-muted-foreground"
                    aria-hidden="true"
                  >
                    {extOf(d.path)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-foreground">{d.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {extOf(d.path)} · {idOf(d.path)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2.5 text-muted-foreground"
                    onClick={() => openLegalDoc(d.path)}
                    aria-label={`Mở ${d.name}`}
                  >
                    <Download className="h-[15px] w-[15px]" />
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </SectionCard>
  );
}
