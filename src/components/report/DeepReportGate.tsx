import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeepReportPaywallDialog } from "@/components/paywall/DeepReportPaywallDialog";
import { PeriodFilterTabs } from "./PeriodFilterTabs";
import { DeepReportPreview } from "./DeepReportPreview";
import { useCredits } from "@/hooks/useCredits";
import {
  formatPeriodLabel,
  latestPeriodId,
  parsePeriod,
} from "@/lib/reportPeriods";

interface DeepReportGateProps {
  reportSlug: string;
  reportLabel: string;
  highlights: string[];
  tocSections: { id: string; label: string }[];
  meta: string;
  renderContent: (periodId: string) => ReactNode;
}

export const DeepReportGate = ({
  reportSlug,
  reportLabel,
  highlights,
  tocSections,
  meta,
  renderContent,
}: DeepReportGateProps) => {
  const { isReportPeriodUnlocked } = useCredits();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const urlPeriod = searchParams.get("period");
  const initialPeriod = useMemo(() => {
    if (urlPeriod && parsePeriod(urlPeriod)) return urlPeriod;
    return latestPeriodId("month");
  }, [urlPeriod]);

  const [currentPeriod, setCurrentPeriod] = useState(initialPeriod);
  const [paywallPeriod, setPaywallPeriod] = useState<string | null>(null);

  // Đồng bộ URL ↔ state khi user đổi kỳ
  useEffect(() => {
    if (currentPeriod && urlPeriod !== currentPeriod) {
      const next = new URLSearchParams(searchParams);
      next.set("period", currentPeriod);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPeriod]);

  // Khi user vừa unlock → tự chuyển sang xem
  useEffect(() => {
    if (
      paywallPeriod &&
      isReportPeriodUnlocked(reportSlug, paywallPeriod)
    ) {
      setCurrentPeriod(paywallPeriod);
      setPaywallPeriod(null);
    }
  }, [paywallPeriod, reportSlug, isReportPeriodUnlocked]);

  const isUnlocked = isReportPeriodUnlocked(reportSlug, currentPeriod);
  const returnPath = `${location.pathname}${location.search}`;

  return (
    <div className="container py-6 md:py-8 space-y-6">
      <PeriodFilterTabs
        reportSlug={reportSlug}
        currentPeriodId={currentPeriod}
        onSelectUnlocked={(pid) => setCurrentPeriod(pid)}
        onSelectLocked={(pid) => setPaywallPeriod(pid)}
      />

      {isUnlocked ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary text-primary-foreground">
              <Check className="h-3 w-3 mr-1" />
              Đã mở khóa vĩnh viễn
            </Badge>
            <span className="text-sm text-muted-foreground">
              Đang xem:{" "}
              <span className="font-semibold text-foreground">
                {formatPeriodLabel(currentPeriod)}
              </span>
            </span>
          </div>

          {renderContent(currentPeriod)}
        </>
      ) : (
        <DeepReportPreview
          reportSlug={reportSlug}
          reportLabel={reportLabel}
          periodId={currentPeriod}
          highlights={highlights}
          tocSections={tocSections}
          meta={meta}
          onUnlockClick={() => setPaywallPeriod(currentPeriod)}
        />
      )}

      <DeepReportPaywallDialog
        open={!!paywallPeriod}
        onOpenChange={(o) => !o && setPaywallPeriod(null)}
        reportSlug={reportSlug}
        reportLabel={reportLabel}
        periodId={paywallPeriod}
        returnPath={returnPath}
      />
    </div>
  );
};
