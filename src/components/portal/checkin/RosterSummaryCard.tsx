import { useState } from "react";
import { AlertTriangle, ListChecks, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { useServerNow } from "@/hooks/useServerClock";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { closeRosterBlockOf, rosterAlertOf, type RosterAlert } from "@/lib/biddingContracts/rosterSummary";
import { cn } from "@/lib/utils";
import type { AuctionSession } from "@/types/auction-session";
import type { CheckinSummary } from "@/types/bidding-contract";
import { CloseRosterDialog } from "./CloseRosterDialog";

interface Props {
  session: AuctionSession;
  summary: CheckinSummary | null | undefined;
  /** dieu-hanh-dau-gia:operate — cùng quyền org_close_roster_now hỏi. */
  canClose: boolean;
  /** Bản gọn cho phòng điều hành: một dòng số + cảnh báo + lối sang tab Điểm danh. */
  compact?: boolean;
  onOpenRoster?: () => void;
}

function AlertBox({ alert }: { alert: RosterAlert }) {
  if (alert.level === "warning") {
    return (
      <InfoBox variant="amber" className="flex gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{alert.title}</p>
          <p>{alert.body}</p>
        </div>
      </InfoBox>
    );
  }
  return (
    <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div>
        <p className="font-semibold text-destructive">{alert.title}</p>
        <p className="text-foreground">{alert.body}</p>
      </div>
    </div>
  );
}

/**
 * Tổng hợp danh sách điểm danh (S6): số có mặt / chờ / vắng / miễn trừ, cảnh báo
 * dưới 2 người có mặt và nút "Chốt danh sách ngay". Số đếm lấy từ
 * auction_session_checkin_summary (tự làm mới 10 giây ở useCheckinSummary).
 */
export function RosterSummaryCard({ session, summary, canClose, compact, onOpenRoster }: Props) {
  const now = useServerNow(15_000);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!summary) return null;

  const alert = rosterAlertOf(summary, session, now);
  // summary tự làm mới 10 giây còn session thì không ⇒ lấy mốc chốt từ summary
  // (cron close_due_rosters chốt mà trang không biết).
  const block = closeRosterBlockOf({ ...session, roster_closed_at: summary.roster_closed_at }, now);
  const showClose = canClose && (block === null || block === "too_early");
  const unexcused = summary.absent - summary.excused;

  const stats = [
    { label: "Có mặt", value: summary.checked_in, hint: `/ ${summary.eligible}`, tone: "text-primary" },
    { label: "Chờ điểm danh", value: summary.awaiting, tone: "text-foreground" },
    { label: "Vắng mặt", value: unexcused, tone: unexcused > 0 ? "text-destructive" : "text-foreground" },
    { label: "Vắng có lý do", value: summary.excused, tone: "text-foreground" },
  ];

  const closeButton = showClose && (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
        disabled={block === "too_early"}
        onClick={() => setConfirmOpen(true)}
      >
        <Lock className="h-4 w-4" />
        Chốt danh sách ngay
      </Button>
      {block === "too_early" && (
        <p className="text-xs text-muted-foreground">Chốt sớm được từ {formatDateTime(session.starts_at)}.</p>
      )}
    </div>
  );

  return (
    <Card className={cn("space-y-4 rounded-2xl", compact ? "p-4" : "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Tổng hợp điểm danh</h2>
          <p className="text-xs text-muted-foreground">
            {summary.roster_closed_at
              ? `Đã chốt danh sách lúc ${formatDateTime(summary.roster_closed_at)}.`
              : "Danh sách tự chốt khi hết giờ điểm danh — ai chưa điểm danh bị ghi vắng và mất tiền đặt trước."}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {compact && onOpenRoster && (
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={onOpenRoster}>
              <ListChecks className="h-4 w-4" />
              Danh sách điểm danh
            </Button>
          )}
          {closeButton}
        </div>
      </div>

      <dl className={cn("grid gap-3", compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4")}>
        {stats.map((s) => (
          <div key={s.label} className={cn("rounded-xl bg-muted", compact ? "px-3 py-2" : "px-4 py-3")}>
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="flex items-baseline gap-1">
              <span className={cn("font-bold", compact ? "text-lg" : "text-2xl", s.tone)}>{s.value}</span>
              {s.hint && <span className="text-sm text-muted-foreground">{s.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {alert && <AlertBox alert={alert} />}

      {showClose && (
        <CloseRosterDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          sessionId={session.id}
          awaiting={summary.awaiting}
        />
      )}
    </Card>
  );
}
