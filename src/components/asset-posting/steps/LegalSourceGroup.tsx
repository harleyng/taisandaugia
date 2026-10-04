import { Scale } from "lucide-react";
import { PostingLegalConsultCard } from "@/components/legal-consult/PostingLegalConsultCard";
import { isExternalComplete } from "@/lib/dossier/draft";
import { SOURCE_LABEL } from "@/lib/dossier/types";
import { Group, Pill } from "../fields";
import { sourcePatch } from "../dossier/dossierWizard";
import { LegalFields } from "../dossier/fields/LegalFields";
import { IncompletePartnerNote, ServiceSourceChoice } from "../service/ServiceSourceChoice";
import type { WizardValues } from "../wizardSchema";

interface LegalSourceGroupProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  postingId: string | null;
  ensurePostingId: () => Promise<string | null>;
}

/** Bước 3 — dịch vụ Pháp lý: đối tác riêng (nhập ý kiến pháp lý) hoặc tư vấn pháp lý của sàn. Tuỳ chọn. */
export function LegalSourceGroup({ f, up, postingId, ensurePostingId }: LegalSourceGroupProps) {
  const d = f.dossier;
  const source = d.legal.source;
  return (
    <Group
      icon={<Scale className="h-4 w-4" />}
      title="Tư vấn pháp lý"
      desc="Tuỳ chọn — rà soát giấy tờ giúp hồ sơ đáng tin hơn với tổ chức đấu giá và người mua."
      right={source === "external_partner" || source === "marketplace" ? <Pill tone="ok">{SOURCE_LABEL[source]}</Pill> : null}
    >
      <div className="flex flex-col gap-4">
        <ServiceSourceChoice kind="legal" value={source} onChange={(v) => up(sourcePatch(f, "legal", v))} />
        {source === "external_partner" && (
          <>
            <LegalFields
              value={d.legal}
              onChange={(p) => up({ dossier: { ...d, legal: { ...d.legal, ...p } } })}
              postingId={postingId}
              resolvePostingId={ensurePostingId}
            />
            {!isExternalComplete(d, "legal") && <IncompletePartnerNote />}
          </>
        )}
        {source === "marketplace" && (
          <PostingLegalConsultCard
            variant="banner"
            postingId={postingId}
            mode="owner"
            resolvePostingId={ensurePostingId}
            postingDocPaths={[...f.ownershipProofUrls, ...f.docUrls]}
          />
        )}
      </div>
    </Group>
  );
}
