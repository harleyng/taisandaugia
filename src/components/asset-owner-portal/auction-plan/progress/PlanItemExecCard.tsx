import { useEffect, useState } from "react";
import { CalendarClock, CircleSlash, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOwnerWorkspaceMembers } from "@/hooks/useOwnerWorkspaceMembers";
import { useSavePlanItemExec, useSetPlanItemExecStatus } from "@/hooks/useAuctionPlanProgress";
import { monthLabel } from "@/lib/auctionPlan/totals";
import { AUCTION_PLAN_EXEC_STATUS_LABELS, type AuctionPlan, type AuctionPlanItem } from "@/lib/auctionPlan/types";

const NOBODY = "none";

interface PlanItemExecCardProps {
  item: AuctionPlanItem;
  plan: AuctionPlan;
  canEdit: boolean;
  /** Trường mốc đang mở (`draft` / `adjusting`) — điều kiện DUY NHẤT để bỏ tài sản. */
  baselineOpen: boolean;
  onForecast: () => void;
}

/**
 * Nhóm trường THỰC HIỆN của một mục: dự kiến mới, người phụ trách, ghi chú, và
 * việc bỏ tài sản khỏi kế hoạch.
 *
 * ⚠️ "Bỏ khỏi kế hoạch" ghi `exec_status`, mà guard của DB coi đó là thay đổi
 * MỐC (A4.6) ⇒ chỉ làm được khi kế hoạch ở nháp / đang điều chỉnh. Nút phải khoá
 * theo `baselineOpen`, không để người dùng bấm rồi nhận lỗi của trigger.
 */
export function PlanItemExecCard({ item, plan, canEdit, baselineOpen, onForecast }: PlanItemExecCardProps) {
  const { data: members } = useOwnerWorkspaceMembers(plan.workspace_id);
  const saveM = useSavePlanItemExec(plan);
  const statusM = useSetPlanItemExecStatus(plan);
  const [note, setNote] = useState(item.exec_note ?? "");

  useEffect(() => setNote(item.exec_note ?? ""), [item.id, item.exec_note]);

  const dropped = item.exec_status === "dropped";

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Thực hiện</h3>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Tháng theo kế hoạch · dự kiến mới</p>
          <p className="text-sm font-medium tabular-nums text-foreground">
            {monthLabel(item.planned_month)}
            {item.forecast_month ? ` → ${monthLabel(item.forecast_month)}` : ""}
          </p>
          {item.forecast_reason && <p className="mt-0.5 text-xs text-muted-foreground">{item.forecast_reason}</p>}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={onForecast}>
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Dời dự kiến
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="exec-responsible" className="text-sm font-medium text-foreground">
          Người phụ trách
        </label>
        <Select
          value={item.responsible_user_id ?? NOBODY}
          disabled={!canEdit || saveM.isPending}
          onValueChange={(v) =>
            v && saveM.mutate({ itemId: item.id, values: { responsible_user_id: v === NOBODY ? null : v } })
          }
        >
          <SelectTrigger id="exec-responsible" className="h-9">
            <SelectValue placeholder="Chưa phân công" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOBODY}>Chưa phân công</SelectItem>
            {(members ?? []).map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.fullName || m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="exec-note" className="text-sm font-medium text-foreground">
          Ghi chú thực hiện
        </label>
        <Textarea
          id="exec-note"
          rows={2}
          value={note}
          disabled={!canEdit}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            const next = note.trim() || null;
            if (next !== (item.exec_note ?? null)) saveM.mutate({ itemId: item.id, values: { exec_note: next } });
          }}
        />
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={dropped ? "outline" : "ghost"}
            size="sm"
            className={dropped ? "h-8 gap-1.5 px-2 text-xs" : "h-8 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"}
            disabled={!baselineOpen || statusM.isPending}
            onClick={() => statusM.mutate({ itemId: item.id, dropped: !dropped })}
          >
            {dropped ? (
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <CircleSlash className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            )}
            {dropped ? "Đưa trở lại kế hoạch" : "Bỏ khỏi kế hoạch"}
          </Button>
          {!baselineOpen && (
            <p className="text-xs text-muted-foreground">
              {dropped ? AUCTION_PLAN_EXEC_STATUS_LABELS.dropped + " · " : ""}
              Bỏ hoặc đưa lại tài sản là thay đổi bản mốc — mở "Điều chỉnh kế hoạch" trước.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
