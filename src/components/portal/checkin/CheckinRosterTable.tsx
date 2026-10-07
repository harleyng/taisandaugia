import { useMemo, useState } from "react";
import { Loader2, Printer, ShieldCheck, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServerNow } from "@/hooks/useServerClock";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { ATTENDANCE_STATE_LABELS } from "@/lib/biddingContracts/eligibility";
import {
  ROSTER_GROUPS,
  ROSTER_GROUP_LABELS,
  buildRoster,
  contractToLookupMatch,
  countRosterGroups,
  type RosterGroup,
} from "@/lib/biddingContracts/checkinRoster";
import { CHECKIN_CHANNEL_LABELS } from "@/lib/biddingContracts/checkinWindow";
import { bidderCardPrintPath, formatBidderNo } from "@/lib/biddingContracts/paths";
import { cn } from "@/lib/utils";
import type { AuctionSession } from "@/types/auction-session";
import { CHECKIN_ATTENDEE_LABELS, type CheckinLookupMatch, type ContractWithSession } from "@/types/bidding-contract";

interface Props {
  session: AuctionSession;
  contracts: ContractWithSession[];
  isLoading: boolean;
  /** false = chỉ xem (phiên trực tuyến / thiếu quyền checkin) — ẩn nút điểm danh. */
  canCheckIn: boolean;
  onSelect: (match: CheckinLookupMatch) => void;
  /** ho-so-tham-gia:update — miễn trừ người vắng (org_excuse_absence). */
  canExcuse: boolean;
  onExcuse: (contract: ContractWithSession) => void;
}

type Filter = RosterGroup | "all";

/** Danh sách điểm danh — tự làm mới 10 giây (useSessionCheckin), nhóm tính theo giờ máy chủ. */
export function CheckinRosterTable({ session, contracts, isLoading, canCheckIn, onSelect, canExcuse, onExcuse }: Props) {
  const now = useServerNow(15_000);
  const [filter, setFilter] = useState<Filter>("all");
  const roster = useMemo(() => buildRoster(contracts, session, now), [contracts, session, now]);
  const counts = countRosterGroups(roster);
  const rows = filter === "all" ? roster : roster.filter((r) => r.group === filter);

  const printCard = (contractId: string) => window.open(bidderCardPrintPath(session.id, contractId) + "?auto=1", "_blank");

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">Danh sách điểm danh ({roster.length})</h2>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo trạng thái điểm danh">
          {(["all", ...ROSTER_GROUPS] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary",
              )}
            >
              {f === "all" ? "Tất cả" : ROSTER_GROUP_LABELS[f]} ({f === "all" ? roster.length : counts[f]})
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải danh sách…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {roster.length === 0 ? "Phiên chưa có hồ sơ tham gia nào đã thanh toán." : "Không có hồ sơ nào ở nhóm này."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 text-center">SBD</TableHead>
                <TableHead>Người tham gia</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Điểm danh</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ contract: c, state, group }) => (
                <TableRow key={c.id}>
                  <TableCell className="text-center font-mono text-lg font-bold text-primary">
                    {formatBidderNo(c.checked_in_at ? c.bidder_no : null) ?? (
                      <span className="text-sm font-normal text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[14rem]">
                    <p className="font-medium text-foreground">{c.org_name ?? c.full_name}</p>
                    {c.org_name && <p className="text-xs text-muted-foreground">ĐDPL: {c.full_name}</p>}
                    {c.has_proxy && <p className="text-xs text-muted-foreground">Uỷ quyền: {c.proxy_full_name}</p>}
                    <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={group === "checked_in" ? "default" : group === "absent" ? "destructive" : "outline"}
                      className="whitespace-nowrap"
                    >
                      {state ? ATTENDANCE_STATE_LABELS[state] : "Đã chốt danh sách"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {c.checked_in_at ? (
                      <>
                        <p className="text-foreground">{formatDateTime(c.checked_in_at)}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.checkin_attendee && CHECKIN_ATTENDEE_LABELS[c.checkin_attendee]}
                          {c.checkin_channel && ` · ${CHECKIN_CHANNEL_LABELS[c.checkin_channel]}`}
                        </p>
                      </>
                    ) : c.absent_at ? (
                      <>
                        <p className="text-xs text-muted-foreground">Ghi vắng {formatDateTime(c.absent_at)}</p>
                        {c.absence_excused_at && (
                          <p className="max-w-[16rem] whitespace-normal text-xs text-muted-foreground">
                            Miễn trừ {formatDateTime(c.absence_excused_at)}
                            {c.absence_note && `: ${c.absence_note}`}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {group === "checked_in" ? (
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => printCard(c.id)}>
                        <Printer className="h-4 w-4" />
                        In thẻ
                      </Button>
                    ) : canExcuse && state === "absent" ? (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onExcuse(c)}>
                        <ShieldCheck className="h-4 w-4" />
                        Miễn trừ
                      </Button>
                    ) : canCheckIn && state === "checkin_open" ? (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => onSelect(contractToLookupMatch(c, state))}
                      >
                        <UserCheck className="h-4 w-4" />
                        Điểm danh
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
