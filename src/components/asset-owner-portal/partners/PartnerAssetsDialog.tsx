import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AUTH_VERDICT_LABEL, DOSSIER_KIND_LABEL } from "@/lib/dossier/types";
import {
  PARTNER_OUTCOME_LABEL,
  assetDeviation,
  money,
  type PartnerAsset,
  type PartnerScore,
} from "@/lib/dossier/partnerScorecard";

interface Props {
  partner: PartnerScore | null;
  onOpenChange: (open: boolean) => void;
}

/** Tài sản đã dùng MỘT đối tác — bấm một dòng mở hồ sơ số hoá. */
export function PartnerAssetsDialog({ partner, onOpenChange }: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={!!partner} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {partner && (
          <>
            <DialogHeader>
              <DialogTitle>{partner.name}</DialogTitle>
              <DialogDescription>
                {DOSSIER_KIND_LABEL[partner.kind]} · {partner.assets.toLocaleString("en-US")} tài sản,{" "}
                {partner.assetsWithOutcome.toLocaleString("en-US")} đã có kết quả phiên
              </DialogDescription>
            </DialogHeader>
            <ul className="divide-y text-sm">
              {partner.assetList.map((a) => (
                <li key={a.postingId}>
                  <button
                    type="button"
                    onClick={() => navigate(`/chu-tai-san/dang-tai-san/${a.postingId}`)}
                    className="flex w-full items-center gap-3 rounded-lg py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {a.code && <span className="mr-1.5 text-muted-foreground">{a.code}</span>}
                        {a.title}
                      </span>
                      <AssetFacts asset={a} kind={partner.kind} />
                    </span>
                    <OutcomeTag asset={a} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssetFacts({ asset: a, kind }: { asset: PartnerAsset; kind: PartnerScore["kind"] }) {
  const facts: string[] = [];
  if (a.rounds > 0) facts.push(`${a.rounds} lượt`);
  if (a.outcome === "sold") facts.push(`Giá trúng ${money(a.soldPrice)}`);
  if (kind === "appraisal") {
    facts.push(`Thẩm định ${money(a.appraisedValue)}`);
    const dev = assetDeviation(a);
    if (dev) facts.push(`lệch ${dev}`);
  }
  if (kind === "authentication" && a.authVerdict) facts.push(`Giám định: ${AUTH_VERDICT_LABEL[a.authVerdict]}`);
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      {facts.length > 0 ? facts.join(" · ") : "Chưa có kết quả phiên"}
      {kind === "legal" && a.legalIssue && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertTriangle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
          Vướng pháp lý
        </span>
      )}
    </span>
  );
}

function OutcomeTag({ asset: a }: { asset: PartnerAsset }) {
  if (!a.outcome) return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        a.outcome === "sold" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
      )}
    >
      {PARTNER_OUTCOME_LABEL[a.outcome]}
    </span>
  );
}
