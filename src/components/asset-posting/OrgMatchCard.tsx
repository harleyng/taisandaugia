import { Award, CheckCircle2, MapPin, Wifi, Coins, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EXPERIENCE_TIER_LABELS, type OrgMatchResult } from "@/lib/orgMatching";

interface OrgMatchCardProps {
  result: OrgMatchResult;
  selected: boolean;
  onSelect: () => void;
}

/** Card so sánh một tổ chức (layout mobile / dạng thẻ). */
export function OrgMatchCard({ result, selected, onSelect }: OrgMatchCardProps) {
  const { org, attrs, score } = result;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border p-4 transition-colors ${
        selected ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{org.name}</p>
            {org.province && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {org.province}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-lg font-bold text-primary leading-none">{Math.round(score)}</span>
          <span className="text-[10px] text-muted-foreground">điểm khớp</span>
          {selected && <CheckCircle2 className="h-4 w-4 text-primary mt-1" />}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Award className="h-3.5 w-3.5 text-accent" /> {EXPERIENCE_TIER_LABELS[attrs.experience_tier]}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {attrs.successful_sessions} phiên thành công
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-warning" /> Thù lao ~{attrs.commission_rate}%
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Wifi className="h-3.5 w-3.5" /> {attrs.has_online_platform ? "Có sàn trực tuyến" : "Đấu giá trực tiếp"}
        </span>
      </div>

      {attrs.facilities.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {attrs.facilities.map((f) => (
            <Badge key={f} variant="secondary" className="text-[10px] font-normal">
              {f}
            </Badge>
          ))}
        </div>
      )}
    </button>
  );
}
