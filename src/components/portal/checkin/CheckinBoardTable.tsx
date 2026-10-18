import { useMemo, useState } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DotPill } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { buildRoster } from "@/lib/biddingContracts/checkinRoster";
import {
  BOARD_GROUPS,
  BOARD_GROUP_LABELS,
  boardGroupOf,
  boardStatusOf,
  formatCheckinTime,
  type BoardGroup,
  type BoardWindow,
} from "@/lib/biddingContracts/checkinBoard";
import type { AttendanceSession, AttendanceState } from "@/lib/biddingContracts/eligibility";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { cn } from "@/lib/utils";
import type { CheckinAttendee, ContractWithSession } from "@/types/bidding-contract";

const TH =
  "whitespace-nowrap border-b bg-muted/40 px-3.5 py-[11px] text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground";
const TD = "border-b px-3.5 py-[13px] align-middle";
const STICKY = "sticky right-0 bg-card shadow-[-1px_0_0_hsl(var(--border))]";
const DASH = <span className="text-muted-foreground/70">—</span>;
/** Cách gọi của design cho cột "Người có mặt". */
const ATTENDEE: Record<CheckinAttendee, string> = { principal: "Chính chủ", proxy: "Người được uỷ quyền" };

type Filter = BoardGroup | "all";

interface Props {
  session: AttendanceSession;
  contracts: ContractWithSession[];
  isLoading: boolean;
  now: Date;
  window: BoardWindow;
  /** Bàn điểm danh tại cửa đang mở và vai trò có quyền checkin. */
  canCheckIn: boolean;
  onCheckIn: (contract: ContractWithSession, state: AttendanceState | null) => void;
  onOpenContract: (contract: ContractWithSession) => void;
  /** ho-so-tham-gia:update — đổi số báo danh / miễn trừ vắng mặt. */
  canUpdate: boolean;
  onAssign: (contract: ContractWithSession) => void;
  onExcuse: (contract: ContractWithSession) => void;
  onPrintCard: (contract: ContractWithSession) => void;
}

/**
 * Danh sách điểm danh (design `checkinTab`): chip lọc theo nhóm + bảng SBD / người
 * tham gia / trạng thái / giờ điểm danh / người có mặt. Chỉ hồ sơ đã duyệt — hồ sơ
 * chờ duyệt / bị từ chối nằm ở tab Hồ sơ tham gia.
 */
export function CheckinBoardTable(props: Props) {
  const { session, contracts, isLoading, now, window, canCheckIn, canUpdate } = props;
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(
    () =>
      buildRoster(
        contracts.filter((c) => c.status === "paid" && c.review_status === "approved"),
        session,
        now,
      ).map((r) => ({ ...r, board: boardGroupOf(r.state) })),
    [contracts, session, now],
  );
  const count = (g: BoardGroup) => rows.filter((r) => r.board === g).length;
  // Như design: chip nhóm rỗng thì ẩn (trừ "Tất cả" và nhóm đang chọn).
  const allChips: [Filter, string, number][] = [
    ["all", "Tất cả", rows.length],
    ...BOARD_GROUPS.map((g): [Filter, string, number] => [g, BOARD_GROUP_LABELS[g], count(g)]),
  ];
  const chips = allChips.filter(([k, , n]) => k === "all" || n > 0 || k === filter);
  const shown = filter === "all" ? rows : rows.filter((r) => r.board === filter);

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3 pl-[22px] pr-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo trạng thái điểm danh">
          {chips.map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === filter}
              onClick={() => setFilter(k)}
              className={cn(
                "h-[30px] rounded-full px-[11px] text-[12.5px] font-semibold transition-colors",
                k === filter ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {label} <span className="ml-0.5 tabular-nums opacity-75">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className={cn(TH, "w-[72px] pl-[22px]")}>SBD</th>
              <th className={TH}>Người tham gia</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Điểm danh lúc</th>
              <th className={TH}>Người có mặt</th>
              <th
                className={cn(
                  TH,
                  STICKY,
                  "w-11 pr-[18px] before:pointer-events-none before:absolute before:inset-0 before:bg-muted/40 before:content-['']",
                )}
                aria-label="Thao tác"
              />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Đang tải danh sách" />
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  {rows.length === 0 ? "Chưa có người tham gia nào được duyệt hồ sơ." : "Không có ai ở nhóm này."}
                </td>
              </tr>
            ) : (
              shown.map(({ contract: c, state, board }) => {
                const status = boardStatusOf(board, window);
                const showCheckIn = canCheckIn && state === "checkin_open";
                const canAssign = canUpdate && board === "in" && window !== "cancelled" && window !== "unsupported";
                const canExcuse = canUpdate && board === "abs";
                const time = formatCheckinTime(c.checked_in_at);
                return (
                  <tr key={c.id} className="[&:last-child>td]:border-b-0">
                    <td className={cn(TD, "pl-[22px]")}>
                      {c.checked_in_at && c.bidder_no != null ? (
                        <span className="inline-block min-w-[44px] rounded-md bg-primary/10 px-[7px] py-0.5 text-center font-mono text-[13px] font-bold text-primary">
                          {formatBidderNo(c.bidder_no)}
                        </span>
                      ) : (
                        DASH
                      )}
                    </td>
                    <td className={cn(TD, "max-w-[300px]")}>
                      <b className="block truncate font-semibold">{c.org_name ?? c.full_name}</b>
                      <small className="mt-0.5 block text-xs text-muted-foreground">
                        {c.org_name && `ĐDPL: ${c.full_name} · `}
                        <span className="font-mono text-[11.5px]">{c.code}</span>
                      </small>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-col items-start gap-1">
                        <DotPill tone={status.tone}>{status.label}</DotPill>
                        {board === "exc" && c.absence_note && (
                          <small className="max-w-[16rem] text-xs text-muted-foreground">{c.absence_note}</small>
                        )}
                      </div>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{time ?? DASH}</td>
                    <td className={TD}>{c.checkin_attendee ? ATTENDEE[c.checkin_attendee] : DASH}</td>
                    <td className={cn(TD, STICKY, "pr-[18px] text-right", !showCheckIn && "w-11")}>
                      <div className="flex items-center justify-end gap-1.5">
                        {showCheckIn && (
                          <Button
                            size="sm"
                            className="h-8 rounded-lg px-[11px] text-[12.5px] font-semibold"
                            onClick={() => props.onCheckIn(c, state)}
                          >
                            Điểm danh
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label="Thao tác">
                              <MoreHorizontal className="h-[18px] w-[18px]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[170px]">
                            <DropdownMenuItem className="text-[13px] font-medium" onClick={() => props.onOpenContract(c)}>
                              Xem hồ sơ gốc
                            </DropdownMenuItem>
                            {board === "in" && (
                              <DropdownMenuItem className="text-[13px] font-medium" onClick={() => props.onPrintCard(c)}>
                                In thẻ số báo danh
                              </DropdownMenuItem>
                            )}
                            {canAssign && (
                              <DropdownMenuItem className="text-[13px] font-medium" onClick={() => props.onAssign(c)}>
                                Gán SBD mới
                              </DropdownMenuItem>
                            )}
                            {canExcuse && (
                              <DropdownMenuItem className="text-[13px] font-medium" onClick={() => props.onExcuse(c)}>
                                Ghi nhận vắng có lý do
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
