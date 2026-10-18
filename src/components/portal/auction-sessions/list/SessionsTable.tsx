import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import { sessionRowState } from "@/lib/auctionSessions/sessionList";
import type { OrgSessionListRow } from "@/types/auction-session";
import { SessionStatePill } from "./SessionStatePill";

const TH =
  "whitespace-nowrap border-b bg-muted/40 px-3.5 py-[11px] text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground";
const TD = "border-b px-3.5 py-[13px] align-middle";
// "Hồ sơ đã bán" ẩn khi màn hẹp (design: ≤ 1200px).
const HM = "hidden min-[1200px]:table-cell";

const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function Muted({ children }: { children: string }) {
  return <span className="text-muted-foreground/70">{children}</span>;
}

/** Ô "Khu vực": phiên trực tuyến không có nơi đến; trực tiếp hiện địa điểm. */
function VenueCell({ s }: { s: OrgSessionListRow }) {
  if (s.auction_format === "truc_tuyen") return <Muted>—</Muted>;
  if (!s.venue && !s.province) return <Muted>Chưa khai báo</Muted>;
  return <b className="block font-medium leading-[1.4] [text-wrap:pretty]">{s.venue || "Chưa có địa chỉ"}</b>;
}

interface Props {
  rows: OrgSessionListRow[];
  onOpen: (s: OrgSessionListRow) => void;
}

/** Bảng phiên: Phiên · Thời gian đấu giá · Khu vực · Tài sản · Hồ sơ đã bán · Trạng thái. */
export function SessionsTable({ rows, onOpen }: Props) {
  const now = new Date();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            <th className={cn(TH, "pl-[22px]")}>Phiên</th>
            <th className={TH}>Thời gian đấu giá</th>
            <th className={TH}>Khu vực</th>
            <th className={cn(TH, "text-right")}>Tài sản</th>
            <th className={cn(TH, HM)}>Hồ sơ đã bán</th>
            <th className={cn(TH, "pr-[18px]")}>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const state = sessionRowState(s, now);
            return (
              <tr
                key={s.id}
                tabIndex={0}
                onClick={() => onOpen(s)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(s)}
                className="cursor-pointer hover:bg-primary/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground [&:last-child>td]:border-b-0"
              >
                <td className={cn(TD, "max-w-[300px] pl-[22px]")}>
                  <b className="block truncate font-semibold" title={s.title}>
                    {s.title}
                  </b>
                  <small className="mt-0.5 block text-xs text-muted-foreground">
                    <span className="rounded-[5px] bg-muted px-1.5 py-px font-mono text-[11.5px] text-foreground">
                      {s.code}
                    </span>
                    {" · "}
                    {AUCTION_FORMAT_LABELS[s.auction_format] ?? s.auction_format}
                  </small>
                </td>
                <td className={cn(TD, "whitespace-nowrap tabular-nums")}>
                  <b className="block font-semibold">{dateOf(s.starts_at)}</b>
                  <small className="block text-xs text-muted-foreground">
                    {timeOf(s.starts_at)}–{timeOf(s.ends_at)}
                  </small>
                </td>
                <td className={cn(TD, "min-w-[200px] max-w-[320px]")}>
                  <VenueCell s={s} />
                </td>
                <td className={cn(TD, "whitespace-nowrap text-right tabular-nums")}>
                  {s.item_count > 0 ? (
                    <>
                      <b className="block font-semibold">{s.item_count} lô</b>
                      <small className="block text-xs text-muted-foreground">
                        {formatMoneyShort(s.total_starting_price)}
                      </small>
                    </>
                  ) : (
                    <>
                      <b className="block font-medium text-muted-foreground/70">Chưa có</b>
                      <small className="block text-xs">&nbsp;</small>
                    </>
                  )}
                </td>
                <td className={cn(TD, HM, "whitespace-nowrap tabular-nums")}>
                  {s.status === "draft" ? (
                    <Muted>—</Muted>
                  ) : (
                    <b className="font-semibold">
                      {s.sold_count}
                      <span className="font-normal text-muted-foreground">
                        {" / "}
                        {s.max_registrants ?? (
                          <span title="Không giới hạn" className="text-[15px]">
                            ∞
                          </span>
                        )}
                      </span>
                    </b>
                  )}
                </td>
                <td className={cn(TD, "pr-[18px]")}>
                  <SessionStatePill state={state} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
