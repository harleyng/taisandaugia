import {
  Ban,
  Banknote,
  FileText,
  Flag,
  Gavel,
  Lock,
  Pause,
  Play,
  RotateCcw,
  TimerReset,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailCard, DetailRow, DetailRows } from "@/components/portal/auction-sessions/DetailCard";
import { cn } from "@/lib/utils";
import { actorLabelOf, describeLotEvent, type ActorSources } from "@/lib/bidding/lotEventText";
import type { LotEvent, LotEventKind } from "@/types/auction-bidding";

/**
 * Nhật ký điều hành — cột trái dưới sân khấu (ngoài design, người dùng giữ lại
 * 18/10). Mỗi loại bước một biểu tượng + màu riêng; số lô là badge cạnh nhãn để
 * dò nhanh lô nào.
 *
 * auction_lot_events CHỈ-GHI-THÊM, chỉ tổ chức đọc được; đây là nơi duy nhất
 * trong sản phẩm nhìn thấy nó. Không nằm trong publication realtime nên
 * useLotEvents tự làm mới theo nhịp 10 giây.
 */

const OK = "bg-primary/10 text-primary";
const WARN = "bg-[hsl(var(--tier-warn-bg))] text-[hsl(var(--tier-warn-strong))]";
const BAD = "bg-destructive/10 text-destructive";
const INFO = "bg-[hsl(var(--tier-info-bg))] text-[hsl(var(--tier-info))]";
const MUTED = "bg-muted text-muted-foreground";

/** Biểu tượng + tông theo loại bước. */
const KIND: Record<LotEventKind, [LucideIcon, string]> = {
  open: [Play, OK],
  pause: [Pause, WARN],
  resume: [RotateCcw, OK],
  bid: [Gavel, INFO],
  bid_rejected: [Ban, BAD],
  extend: [TimerReset, WARN],
  withdraw_bid: [Undo2, MUTED],
  close: [Lock, MUTED],
  withdraw_lot: [XCircle, BAD],
  finalize: [Flag, OK],
  minutes: [FileText, INFO],
  payment: [Banknote, OK],
};

const p2 = (n: number) => String(n).padStart(2, "0");
/** "09:58:12 10/10/26" — hh:mm:ss dd/mm/yy. */
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};

interface Props {
  events: LotEvent[] | undefined;
  isLoading: boolean;
  lotNoById: Map<string, number>;
  actors: ActorSources;
}

export function LotEventLog({ events, isLoading, lotNoById, actors }: Props) {
  return (
    <DetailCard title="Nhật ký điều hành">
      {isLoading ? (
        <DetailRows>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="my-2 h-10 w-full rounded-lg" />
          ))}
        </DetailRows>
      ) : !events?.length ? (
        <p className="px-[22px] pb-6 pt-4 text-center text-sm text-muted-foreground">
          Chưa có thao tác nào được ghi nhận.
        </p>
      ) : (
        <DetailRows className="max-h-[28rem] overflow-y-auto pb-3">
          {events.map((event) => {
            const { label, detail } = describeLotEvent(event, lotNoById);
            const [Icon, tone] = KIND[event.kind] ?? [FileText, MUTED];
            const lotNo = event.lot_id ? lotNoById.get(event.lot_id) : undefined;
            return (
              <DetailRow
                key={event.id}
                lead={
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                }
                title={
                  <span className="flex items-center gap-2">
                    {lotNo != null && (
                      <span className="rounded-md bg-muted px-1.5 py-px font-mono text-[11.5px] font-bold text-foreground">
                        L{lotNo}
                      </span>
                    )}
                    {label}
                  </span>
                }
                sub={[detail, actorLabelOf(event.actor_id, actors)].filter(Boolean).join(" · ")}
                value={<small className="text-xs font-medium tabular-nums text-muted-foreground">{timeOf(event.at)}</small>}
              />
            );
          })}
        </DetailRows>
      )}
    </DetailCard>
  );
}
