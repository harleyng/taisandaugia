import { Link } from "react-router-dom";
import { ArrowUpRight, CircleCheck, Gavel, PackageCheck } from "lucide-react";
import { usePublicOrgStats } from "@/hooks/usePublicSessionPage";
import type { PublicSessionOrg } from "@/types/auction-session";

/** Tổ chức đấu giá + 3 số liệu công khai (RPC public_auction_org_stats). */
export function SessionOrgCard({ org }: { org: PublicSessionOrg }) {
  const { data: stats } = usePublicOrgStats(org.id);
  const rate =
    stats && stats.finalized_count > 0 ? `${Math.round((stats.successful_sessions / stats.finalized_count) * 100)}%` : "—";
  const items = [
    { icon: Gavel, value: stats ? String(stats.sessions_count) : "—", label: "phiên tổ chức" },
    { icon: CircleCheck, value: rate, label: "phiên thành" },
    { icon: PackageCheck, value: stats ? String(stats.lots_sold) : "—", label: "tài sản đã bán" },
  ];

  return (
    <Link
      to={`/auction-org/${org.id}`}
      aria-label={`Xem tổ chức ${org.name}`}
      className="group flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-transparent transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3">
        {org.logo_url ? (
          <img src={org.logo_url} alt={org.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted font-semibold text-muted-foreground">
            {org.name.replace(/^Công ty\s+/i, "").charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <span className="text-xs text-muted-foreground">Tổ chức đấu giá</span>
          <div className="font-semibold text-foreground transition-colors group-hover:text-primary">{org.name}</div>
        </div>
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary"
        >
          <ArrowUpRight className="h-5 w-5 text-foreground transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-primary-foreground" />
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {items.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex min-w-0 items-center gap-2">
            <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <div className="min-w-0">
              <b className="block text-base leading-tight text-foreground">{value}</b>
              <span className="block text-xs leading-tight text-muted-foreground">{label}</span>
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}
