import { Calculator } from "lucide-react";
import { PostingValuationCard } from "@/components/valuation/PostingValuationCard";
import { usePostingValuationOrders } from "@/hooks/useValuationOrders";
import { formatVnd } from "@/lib/advertising/slug";
import { isExternalComplete } from "@/lib/dossier/draft";
import { SOURCE_LABEL } from "@/lib/dossier/types";
import { summarizeValuations } from "@/lib/valuation/status";
import { Group, Pill } from "../fields";
import { appraisalPatch, sourcePatch } from "../dossier/dossierWizard";
import { AppraisalFields } from "../dossier/fields/AppraisalFields";
import { IncompletePartnerNote, ServiceSourceChoice } from "../service/ServiceSourceChoice";
import type { WizardValues } from "../wizardSchema";

interface ValuationGroupProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  postingId: string | null;
  ensurePostingId: () => Promise<string | null>;
}

/**
 * Bước 4 — Thẩm định giá: đối tác riêng (nhập giá trị + chứng thư; giá trị điền sẵn giá khởi
 * điểm) hoặc đơn thẩm định giá qua sàn. Kết quả của sàn KHÔNG tự đổi giá khởi điểm
 * (BR-TDG-03) — người bán bấm "Dùng làm giá khởi điểm".
 */
export function ValuationGroup({ f, up, postingId, ensurePostingId }: ValuationGroupProps) {
  const d = f.dossier;
  const source = d.appraisal.source;
  const { data: rows = [] } = usePostingValuationOrders(source === "marketplace" ? postingId : null);
  const { current } = summarizeValuations(rows);
  const platformValue = current?.appraised_value != null ? String(current.appraised_value) : null;
  const canUseValue =
    !!platformValue && f.wantsAuction === "yes" && f.pricingMode === "self" && f.startingPrice !== platformValue;

  return (
    <Group
      icon={<Calculator className="h-4 w-4" />}
      title="Thẩm định giá"
      desc="Chứng thư thẩm định giá độc lập làm căn cứ đặt giá khởi điểm."
      right={source === "external_partner" || source === "marketplace" ? <Pill tone="ok">{SOURCE_LABEL[source]}</Pill> : null}
    >
      <div className="flex flex-col gap-4">
        <ServiceSourceChoice kind="appraisal" value={source} onChange={(v) => up(sourcePatch(f, "appraisal", v))} />
        {source === "external_partner" && (
          <>
            <AppraisalFields
              value={d.appraisal}
              onChange={(p) => up(appraisalPatch(f, p))}
              postingId={postingId}
              resolvePostingId={ensurePostingId}
            />
            {!isExternalComplete(d, "appraisal") && <IncompletePartnerNote />}
          </>
        )}
        {source === "marketplace" && (
          <>
            <PostingValuationCard
              variant="banner"
              postingId={postingId}
              mode="owner"
              resolvePostingId={ensurePostingId}
            />
            {canUseValue && (
              <button
                type="button"
                onClick={() => up({ startingPrice: platformValue! })}
                className="self-start rounded-lg px-2 py-1 text-[13px] font-semibold text-primary transition hover:bg-primary/5"
              >
                Dùng {formatVnd(platformValue)} làm giá khởi điểm
              </button>
            )}
          </>
        )}
      </div>
    </Group>
  );
}
