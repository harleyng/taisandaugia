import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSyncDossierItems, type DossierItemRow } from "@/hooks/useDossierItems";
import { isExternalComplete, rowsToDraft, type DossierDraft } from "@/lib/dossier/draft";
import type { DossierKind } from "@/lib/dossier/types";
import { AppraisalFields } from "../dossier/fields/AppraisalFields";
import { AuctionPartnerFields } from "../dossier/fields/AuctionPartnerFields";
import { AuthenticationFields } from "../dossier/fields/AuthenticationFields";
import { LegalFields } from "../dossier/fields/LegalFields";

interface OwnPartnerFormProps {
  kind: DossierKind;
  postingId: string;
  /** Các dòng đã lưu của hồ sơ — dựng lại form khi dòng của phần này đổi. */
  items: DossierItemRow[];
  /** Chỉ xem (không có quyền sửa / hồ sơ đã huỷ). */
  readOnly: boolean;
}

/** Form "Đối tác riêng" của MỘT dịch vụ ở trang chi tiết hồ sơ — Lưu ghi đúng dòng của dịch vụ đó. */
export function OwnPartnerForm({ kind, postingId, items, readOnly }: OwnPartnerFormProps) {
  const sync = useSyncDossierItems();
  const saved = items.find((r) => r.kind === kind);
  const [draft, setDraft] = useState<DossierDraft>(() => rowsToDraft(items, { [kind]: "external_partner" }));
  const [showErrors, setShowErrors] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Bản lưu đổi (lưu xong / nơi khác sửa) ⇒ nạp lại khi người dùng không đang sửa dở.
  useEffect(() => {
    if (dirty) return;
    setDraft(rowsToDraft(items, { [kind]: "external_partner" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.updated_at, kind]);

  const patch = <K extends DossierKind>(k: K, p: Partial<DossierDraft[K]>) => {
    setDirty(true);
    setDraft((d) => ({ ...d, [k]: { ...d[k], ...p } }));
  };

  const save = () => {
    const next = { ...draft, [kind]: { ...draft[kind], source: "external_partner" as const } };
    if (!isExternalComplete(next, kind)) {
      setShowErrors(true);
      return;
    }
    sync.mutate({ postingId, draft: next, kinds: [kind] }, { onSuccess: () => setDirty(false) });
  };

  const disabled = readOnly || sync.isPending;
  const fields =
    kind === "appraisal" ? (
      <AppraisalFields
        value={draft.appraisal}
        onChange={(p) => patch("appraisal", p)}
        postingId={postingId}
        showErrors={showErrors}
        disabled={disabled}
      />
    ) : kind === "authentication" ? (
      <AuthenticationFields
        value={draft.authentication}
        onChange={(p) => patch("authentication", p)}
        postingId={postingId}
        showErrors={showErrors}
        disabled={disabled}
      />
    ) : kind === "legal" ? (
      <LegalFields
        value={draft.legal}
        onChange={(p) => patch("legal", p)}
        postingId={postingId}
        showErrors={showErrors}
        disabled={disabled}
      />
    ) : (
      <AuctionPartnerFields
        value={draft.auction}
        onChange={(p) => patch("auction", p)}
        showErrors={showErrors}
        disabled={disabled}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      {fields}
      {!readOnly && (
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          {saved?.source === "external_partner" && !dirty && (
            <span className="text-xs text-muted-foreground">Đã lưu</span>
          )}
          <Button onClick={save} disabled={sync.isPending || (!dirty && saved?.source === "external_partner")}>
            {sync.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </div>
      )}
    </div>
  );
}
