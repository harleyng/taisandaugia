import { DotPill } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { DEPOSIT_PILL, REVIEW_PILL } from "@/lib/biddingContracts/contractDetail";
import { cn } from "@/lib/utils";
import type { ContractWithSession } from "@/types/bidding-contract";

const TH =
  "whitespace-nowrap border-b bg-muted/40 px-3.5 py-[11px] text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground";
const TD = "border-b px-3.5 py-[13px] align-middle";
const TAG = "rounded-[5px] bg-muted px-1.5 py-px font-mono text-[11.5px] text-foreground";

const p2 = (n: number) => String(n).padStart(2, "0");
const dateOf = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

interface Props {
  rows: ContractWithSession[];
  onOpen: (c: ContractWithSession) => void;
}

/** Bảng hồ sơ toàn tổ chức (design pdg-hslist.js): Người đăng ký · Phiên · Duyệt hồ sơ · Tiền đặt trước. */
export function OrgContractsTable({ rows, onOpen }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            <th className={cn(TH, "pl-[22px]")}>Người đăng ký</th>
            <th className={TH}>Phiên</th>
            <th className={TH}>Duyệt hồ sơ</th>
            <th className={cn(TH, "pr-[18px]")}>Tiền đặt trước</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const name = c.org_name ?? c.full_name;
            const s = c.auction_sessions;
            const rv = REVIEW_PILL[c.review_status];
            const dp = DEPOSIT_PILL[c.deposit_status];
            return (
              <tr
                key={c.id}
                tabIndex={0}
                onClick={() => onOpen(c)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(c)}
                className="cursor-pointer hover:bg-primary/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground [&:last-child>td]:border-b-0"
              >
                <td className={cn(TD, "max-w-[300px] pl-[22px]")}>
                  <b className="block truncate font-semibold" title={name}>
                    {name}
                  </b>
                  <small className="mt-0.5 block truncate text-xs text-muted-foreground">
                    <span className={TAG}>{c.code}</span>
                    {" · "}
                    {c.org_name ? `ĐDPL ${c.full_name}` : "Cá nhân"}
                  </small>
                </td>
                <td className={cn(TD, "max-w-[300px]")}>
                  <b className="block truncate font-semibold" title={s?.title}>
                    {s?.title ?? "—"}
                  </b>
                  {s && (
                    <small className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                      {s.code && (
                        <>
                          <span className={TAG}>{s.code}</span>
                          {" · "}
                        </>
                      )}
                      {dateOf(s.starts_at)}
                    </small>
                  )}
                </td>
                <td className={TD}>
                  <DotPill tone={rv.tone}>{rv.label}</DotPill>
                </td>
                <td className={cn(TD, "pr-[18px]")}>
                  <DotPill tone={dp.tone}>{dp.label}</DotPill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
