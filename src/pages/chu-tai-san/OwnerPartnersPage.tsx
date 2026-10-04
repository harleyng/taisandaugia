import { useMemo, useState } from "react";
import { Gavel, Landmark, Scale, ShieldCheck, type LucideIcon } from "lucide-react";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { PartnerScorecardTable } from "@/components/asset-owner-portal/partners/PartnerScorecardTable";
import { PartnerAssetsDialog } from "@/components/asset-owner-portal/partners/PartnerAssetsDialog";
import {
  PartnersEmpty,
  PartnersLoadError,
  PartnersNoWorkspace,
  PartnersSkeleton,
} from "@/components/asset-owner-portal/partners/PartnerPageStates";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerPartnerScorecard } from "@/hooks/useOwnerPartnerScorecard";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { DOSSIER_KIND_LABEL, type DossierKind } from "@/lib/dossier/types";
import {
  PARTNER_KINDS,
  PARTNER_KIND_INTRO,
  partnersOfKind,
  type PartnerScore,
} from "@/lib/dossier/partnerScorecard";

const KIND_ICON: Record<DossierKind, LucideIcon> = {
  appraisal: Scale,
  authentication: ShieldCheck,
  legal: Landmark,
  auction: Gavel,
};
const DEFAULTS = { tab: "appraisal" };

/**
 * "Đối tác của tôi" — /chu-tai-san/doi-tac (docs/owner-dossier-plan.md Phase 5, nhóm Tác nghiệp).
 * So các đơn vị thẩm định giá / giám định / pháp lý / tổ chức đấu giá mà Trạm TỰ NHẬP trong hồ sơ số hoá
 * trên kết quả phiên thực tế. Riêng tư theo Trạm; không ảnh hưởng điểm tin cậy hồ sơ (D3).
 */
const OwnerPartnersPage = () => {
  const { workspaceId, workspace, isLoading: wsLoading } = useOwnerWorkspace();
  const { rows, isLoading, isError, refetch } = useOwnerPartnerScorecard(workspaceId);
  const [f, , setFilters] = useUrlFilterState(DEFAULTS, { tab: PARTNER_KINDS });
  const kind = f.tab as DossierKind;
  const [selected, setSelected] = useState<PartnerScore | null>(null);

  const tabs = useMemo(
    () =>
      PARTNER_KINDS.map((k) => ({
        value: k,
        label: DOSSIER_KIND_LABEL[k],
        icon: KIND_ICON[k],
        count: partnersOfKind(rows, k).length,
      })),
    [rows],
  );
  const partners = useMemo(() => partnersOfKind(rows, kind), [rows, kind]);

  if (wsLoading || (workspaceId && isLoading)) return <PartnersSkeleton />;
  if (!workspaceId || !workspace) return <PartnersNoWorkspace />;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Đối tác của tôi"
        subtitle="So các đơn vị bạn đang dùng trên kết quả phiên thực tế — chỉ Trạm của bạn thấy"
      />

      <OwnerTabBar
        aria-label="Loại đối tác"
        value={kind}
        onValueChange={(tab) => setFilters({ tab })}
        items={tabs}
      />

      {isError ? (
        <PartnersLoadError onRetry={() => void refetch()} />
      ) : partners.length === 0 ? (
        <PartnersEmpty kind={kind} />
      ) : (
        <SectionCard title={DOSSIER_KIND_LABEL[kind]} icon={KIND_ICON[kind]} count={partners.length}>
          <p className="-mt-1 text-sm text-muted-foreground">{PARTNER_KIND_INTRO[kind]}</p>
          <PartnerScorecardTable kind={kind} partners={partners} onSelect={setSelected} />
        </SectionCard>
      )}

      <PartnerAssetsDialog partner={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
};

export default OwnerPartnersPage;
