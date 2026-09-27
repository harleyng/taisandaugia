import { useMemo, useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { cn } from "@/lib/utils";
import { useLegalConsultItems, usePostingLegalConsultations } from "@/hooks/useLegalConsultations";
import { countByStatus, sortItemsForSeller } from "@/lib/legalConsult/checklist";
import { itemStatusLabel, summarizeConsultations } from "@/lib/legalConsult/status";
import { ActiveLegalConsult } from "@/components/legal-consult/ActiveLegalConsult";
import { LegalConsultHistory } from "@/components/legal-consult/LegalConsultHistory";
import { LegalDocChips } from "@/components/legal-consult/LegalDocChips";
import { RequestLegalConsultDialog } from "@/components/legal-consult/RequestLegalConsultDialog";
import type { ChecklistItemStatus } from "@/types/legalConsult";
import type { AssetPosting } from "@/types/asset-posting";
import { usePostingCanWrite } from "../postingAccess";
import { CardAux, EmptyServiceCard, KvList } from "./detailParts";

const HISTORY_ID = "tvpl-lich-su";

const VTAG: Record<ChecklistItemStatus, string> = {
  sufficient: "bg-success/10 text-success",
  needs_clarification: "bg-warning/15 text-foreground",
  missing: "bg-destructive/10 text-destructive",
};

const day = (iso: string | null) => (iso ? format(new Date(iso), "dd/MM/yyyy", { locale: vi }) : "—");

/**
 * Tab "Tư vấn pháp lý": kết quả hiện hành (checklist Đủ / Thiếu / Cần làm rõ) + thẻ
 * chuyên gia bên phải; lần đang chạy và các phiên bản cũ dùng lại component của luồng
 * tư vấn. BR-CNS-01: chỉ mang tính tư vấn — không đổi trạng thái hồ sơ.
 */
export function PostingLegalTab({ posting: p, locked }: { posting: AssetPosting; locked: boolean }) {
  const [open, setOpen] = useState(false);
  const canWrite = usePostingCanWrite();
  const { data: rows = [], isLoading } = usePostingLegalConsultations(p.id);
  const { active, current, versions } = summarizeConsultations(rows);
  const { data: items = [], isLoading: itemsLoading } = useLegalConsultItems(current?.id);
  const available = useMemo(
    () => [...(p.ownership_proof_urls ?? []), ...(p.doc_urls ?? []), ...(rows[0]?.submitted_doc_paths ?? [])],
    [p.ownership_proof_urls, p.doc_urls, rows],
  );
  const canRequest = canWrite && !active && !locked;

  const dialog = canWrite && (
    <RequestLegalConsultDialog
      open={open}
      onOpenChange={setOpen}
      resolvePostingId={async () => p.id}
      availableDocPaths={available}
      isFollowUp={!!current}
    />
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tư vấn pháp lý…
      </div>
    );
  }

  if (!current && !active) {
    return (
      <>
        <EmptyServiceCard
          title="Chưa có yêu cầu tư vấn pháp lý"
          description="Chuyên gia rà soát giấy tờ hiện có, chỉ ra mục nào đủ, mục nào còn thiếu trước khi đưa tài sản ra đấu giá."
          action={canRequest && <Button onClick={() => setOpen(true)}>Yêu cầu tư vấn</Button>}
        />
        {dialog}
      </>
    );
  }

  const sorted = sortItemsForSeller(items);
  const counts = countByStatus(items);
  const pending = counts.missing + counts.needs_clarification;
  const previous = versions.find((v) => v.status === "superseded") ?? null;

  return (
    <div className={cn("grid items-start gap-5", current && "xl:grid-cols-[minmax(0,1fr)_330px]")}>
      <div className="flex min-w-0 flex-col gap-4">
        {active && (
          <SectionCard title="Yêu cầu đang xử lý">
            <ActiveLegalConsult row={active} mode="owner" />
          </SectionCard>
        )}

        {current && (
          <SectionCard
            title="Kết quả tư vấn pháp lý"
            actions={
              <CardAux>
                Bản {current.version} · hoàn tất {day(current.completed_at)}
              </CardAux>
            }
          >
            {current.summary && (
              <p className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm text-foreground">{current.summary}</p>
            )}
            {itemsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải checklist…
              </div>
            ) : (
              <ul className="flex flex-col">
                {sorted.map((it) => {
                  const note = it.status !== "sufficient" && it.required_action ? it.required_action : it.expert_note;
                  return (
                    <li
                      key={it.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-border py-3 first:border-t-0 first:pt-0"
                    >
                      <span className="text-[13.5px] font-semibold text-foreground">{it.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-[9px] py-[3px] text-xs font-semibold",
                          it.status ? VTAG[it.status as ChecklistItemStatus] : "bg-muted text-muted-foreground",
                        )}
                      >
                        {itemStatusLabel(it.status)}
                      </span>
                      {note && <p className="col-span-2 text-[13px] text-foreground/70">{note}</p>}
                      {it.doc_paths.length > 0 && (
                        <div className="col-span-2 pt-1">
                          <LegalDocChips paths={it.doc_paths} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Kết quả mang tính tư vấn, không thay thế việc sàn duyệt hồ sơ và không tự xác nhận tài sản đủ điều kiện đấu giá.
            </p>
          </SectionCard>
        )}

        {previous && (
          <div id={HISTORY_ID} className="scroll-mt-6 rounded-2xl bg-card p-4 shadow-card sm:p-5">
            <LegalConsultHistory versions={versions} />
          </div>
        )}
      </div>

      {current && (
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6">
          <SectionCard title="Chuyên gia">
            <div>
              <KvList
                rows={[
                  { k: "Người rà soát", v: current.expert_name ?? "—" },
                  ...(current.partner_name ? [{ k: "Đơn vị", v: current.partner_name }] : []),
                  {
                    k: "Kết luận",
                    v:
                      items.length === 0 ? (
                        "—"
                      ) : pending > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
                          Cần bổ sung {pending} mục
                        </span>
                      ) : (
                        <span className="text-success">Đủ hồ sơ theo checklist</span>
                      ),
                  },
                  ...(previous
                    ? [
                        {
                          k: "Phiên bản trước",
                          v: (
                            <button
                              type="button"
                              className="font-semibold text-primary hover:underline"
                              onClick={() =>
                                document.getElementById(HISTORY_ID)?.scrollIntoView({ behavior: "smooth" })
                              }
                            >
                              Bản {previous.version} · {day(previous.completed_at).slice(0, 5)}
                            </button>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
              {canRequest && (
                <Button variant="outline" className="mt-3 w-full" onClick={() => setOpen(true)}>
                  Yêu cầu rà soát lại
                </Button>
              )}
            </div>
          </SectionCard>
        </aside>
      )}

      {dialog}
    </div>
  );
}
