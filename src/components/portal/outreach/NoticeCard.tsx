import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Lock, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "./CopyButton";
import { OutreachFieldEditor } from "./OutreachFieldEditor";
import { useSaveCaseFile } from "@/hooks/useSessionOutreach";
import { caseSlotValues, parseCaseFile } from "@/lib/outreach/caseFile";
import { noticeFieldKey } from "@/lib/outreach/fieldKeys";
import { CASE_SLOTS, noticeTemplate, type CaseSlotKey, type FactSlotKey } from "@/lib/outreach/noticeTemplate";
import { renderNotice } from "@/lib/outreach/renderNotice";
import type { OutreachEdit, OutreachField, OutreachPack } from "@/types/outreach";

interface Props {
  sessionId: string;
  pack: OutreachPack | null;
  facts: Record<FactSlotKey, string>;
  fieldsByKey: Map<string, OutreachField>;
  editsByKey: Map<string, OutreachEdit[]>;
  readOnly: boolean;
  canSend: boolean;
  onMarkSent: (text: string) => void;
}

/**
 * Thông báo đấu giá: câu chữ KHOÁ (biểu tượng ổ khoá, không có ô nhập), dữ kiện
 * phiên chỉ đọc, ô hồ sơ vụ việc do tổ chức nhập, ô mô tả do trình soạn điền.
 */
export function NoticeCard({ sessionId, pack, facts, fieldsByKey, editsByKey, readOnly, canSend, onMarkSent }: Props) {
  const template = noticeTemplate(pack?.notice_template_version);
  const save = useSaveCaseFile(sessionId);
  const [cases, setCases] = useState<Record<CaseSlotKey, string>>(() => caseSlotValues(parseCaseFile(pack?.case_file)));
  useEffect(() => setCases(caseSlotValues(parseCaseFile(pack?.case_file))), [pack?.case_file]);

  const locked = readOnly || !pack;
  const drafts = {
    asset_description: fieldsByKey.get(noticeFieldKey("asset_description"))?.value ?? "",
    asset_condition: fieldsByKey.get(noticeFieldKey("asset_condition"))?.value ?? "",
  };
  const rendered = useMemo(() => renderNotice(template, { facts, cases, drafts }), [template, facts, cases, drafts.asset_description, drafts.asset_condition]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitCases = () => {
    if (!pack) return;
    const server = parseCaseFile(pack.case_file);
    if (JSON.stringify(caseSlotValues(server)) === JSON.stringify(cases)) return;
    save.mutate({ packId: pack.id, caseFile: { ...server, ...cases } });
  };

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Thông báo đấu giá tài sản</h2>
          <p className="text-sm text-muted-foreground">
            Mẫu phiên bản {template.version}. Câu chữ có biểu tượng <Lock className="inline h-3 w-3" /> là cố định — không
            sửa được ở đây và trình soạn không viết lại.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={rendered.text} label="Sao chép thông báo" />
          <Button size="sm" variant="outline" className="gap-1.5" disabled={!canSend || rendered.missing.length > 0} onClick={() => onMarkSent(rendered.text)}>
            <Megaphone className="h-4 w-4" />
            Đánh dấu đã niêm yết
          </Button>
        </div>
      </div>

      {template.reviewStatus === "pending_legal_review" && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          Mẫu đang chờ bộ phận pháp chế rà soát. Đối chiếu với quy định hiện hành trước khi niêm yết chính thức.
        </p>
      )}

      <div className="space-y-4 rounded-xl border p-4">
        {rendered.blocks.map((b, i) => {
          if (b.kind !== "field") {
            return b.kind === "heading" ? (
              <p key={i} className="text-center text-base font-bold tracking-wide text-foreground">{b.text}</p>
            ) : (
              <p key={i} className="flex gap-2 rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {b.text}
              </p>
            );
          }
          return (
            <div key={i} className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Lock className="h-3 w-3 text-muted-foreground" />
                {b.label}
              </p>
              {b.slots.map((s) => {
                if (s.source === "fact") {
                  return (
                    <p key={s.key} className="whitespace-pre-line pl-5 text-sm text-foreground">
                      {s.value || (s.required ? <span className="text-warning">Chưa có {s.label.toLowerCase()} — cập nhật ở thông tin phiên / tài sản.</span> : null)}
                    </p>
                  );
                }
                if (s.source === "case") {
                  const key = s.key as CaseSlotKey;
                  return (
                    <div key={s.key} className="pl-5">
                      <Textarea
                        rows={2}
                        value={cases[key]}
                        readOnly={locked}
                        placeholder={`${CASE_SLOTS[key].label}${CASE_SLOTS[key].hint ? ` — ${CASE_SLOTS[key].hint}` : ""}${s.required ? " (bắt buộc)" : ""}`}
                        onChange={(e) => setCases((c) => ({ ...c, [key]: e.target.value }))}
                        onBlur={commitCases}
                        className={s.missing ? "border-warning/60 text-sm" : "text-sm"}
                      />
                    </div>
                  );
                }
                const fieldKey = noticeFieldKey(s.key);
                return (
                  <div key={s.key} className="pl-5">
                    <OutreachFieldEditor
                      sessionId={sessionId}
                      packId={pack?.id ?? null}
                      fieldKey={fieldKey}
                      field={fieldsByKey.get(fieldKey)}
                      edits={editsByKey.get(fieldKey) ?? []}
                      readOnly={readOnly}
                      rows={4}
                      placeholder={`${s.label} — trình soạn điền, bạn sửa được`}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {rendered.missing.length > 0 && (
        <p className="text-sm text-warning">
          Còn thiếu {rendered.missing.length} mục bắt buộc: {rendered.missing.map((m) => m.label.toLowerCase()).join(", ")}.
        </p>
      )}
    </Card>
  );
}
