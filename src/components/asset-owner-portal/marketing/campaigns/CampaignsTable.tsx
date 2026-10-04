import { useNavigate } from "react-router-dom";
import { formatShareDay } from "@/lib/ownerReportShare";
import { CAMPAIGN_CHANNEL_META, type CampaignRow } from "@/lib/ownerMarketing/campaigns";
import { ownerCampaignHref } from "@/lib/ownerMarketing/routes";
import { cn } from "@/lib/utils";
import { CampaignStatusBadge } from "./CampaignStatusBadge";

interface CampaignsTableProps {
  rows: CampaignRow[];
  personName: (userId: string | null) => string | null;
}

const TH =
  "whitespace-nowrap border-b bg-muted/30 px-3.5 py-[11px] text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground";
const TD = "px-3.5 py-[13px] align-middle";

/** Bảng chiến dịch: Chiến dịch · Tài sản · Trạng thái · Cập nhật. Bấm dòng ⇒ chi tiết. */
export function CampaignsTable({ rows, personName }: CampaignsTableProps) {
  const navigate = useNavigate();
  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className={cn(TH, "pl-[22px]")}>Chiến dịch</th>
              <th className={TH}>Tài sản</th>
              <th className={TH}>Trạng thái</th>
              <th className={cn(TH, "hidden pr-[18px] md:table-cell")}>Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const first = r.facts.assets[0]?.title ?? "Tài sản";
              const more = r.assetKeys.length - 1;
              const by = personName(r.createdBy);
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30"
                  onClick={() => navigate(ownerCampaignHref(r.id))}
                >
                  <td className={cn(TD, "max-w-[300px] pl-[22px]")}>
                    <button
                      type="button"
                      className="block max-w-full truncate text-left font-semibold text-foreground hover:text-primary"
                      title={r.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(ownerCampaignHref(r.id));
                      }}
                    >
                      {r.name}
                    </button>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {r.channels.map((c) => {
                        const Icon = CAMPAIGN_CHANNEL_META[c].icon;
                        return (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            <Icon className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                            {CAMPAIGN_CHANNEL_META[c].label}
                          </span>
                        );
                      })}
                    </span>
                  </td>
                  <td className={cn(TD, "max-w-[280px]")}>
                    <span className="block truncate text-foreground" title={first}>
                      {first}
                    </span>
                    <small className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {[more > 0 ? `+${more} tài sản khác` : null, r.branchName].filter(Boolean).join(" · ") || " "}
                    </small>
                  </td>
                  <td className={TD}>
                    <CampaignStatusBadge status={r.status} />
                  </td>
                  <td className={cn(TD, "hidden whitespace-nowrap pr-[18px] md:table-cell")}>
                    {formatShareDay(r.updatedAt)}
                    {by && <small className="block max-w-[160px] truncate text-xs text-muted-foreground">{by}</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
