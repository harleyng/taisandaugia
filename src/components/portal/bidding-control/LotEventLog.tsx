import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { actorLabelOf, describeLotEvent, type ActorSources } from "@/lib/bidding/lotEventText";
import type { LotEvent } from "@/types/auction-bidding";

/**
 * Nhật ký điều hành — bằng chứng phiên đã diễn ra thế nào.
 *
 * auction_lot_events là bảng CHỈ-GHI-THÊM và chỉ tổ chức đọc được; đây là nơi
 * duy nhất trong sản phẩm nhìn thấy nó. Không nằm trong publication realtime
 * nên useLotEvents tự làm mới theo nhịp 10 giây.
 */

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

interface Props {
  events: LotEvent[] | undefined;
  isLoading: boolean;
  lotNoById: Map<string, number>;
  actors: ActorSources;
}

export function LotEventLog({ events, isLoading, lotNoById, actors }: Props) {
  return (
    <Card className="rounded-2xl p-5">
      <div className="mb-3">
        <h2 className="font-semibold text-foreground">Nhật ký điều hành</h2>
        <p className="text-xs text-muted-foreground">
          Ghi nhận tự động, không sửa và không xoá được. Mới nhất lên đầu.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : !events?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Chưa có thao tác nào được ghi nhận.</p>
      ) : (
        <ol className="max-h-[28rem] space-y-2 overflow-y-auto">
          {events.map((event) => {
            const { label, detail, lotLabel } = describeLotEvent(event, lotNoById);
            return (
              <li key={event.id} className="rounded-lg border border-border p-2.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{timeOf(event.at)}</span>
                  {lotLabel && <span className="text-xs font-medium text-muted-foreground">{lotLabel}</span>}
                  <span className="font-medium text-foreground">{label}</span>
                </div>
                {detail && <p className="mt-0.5 text-xs text-foreground">{detail}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">{actorLabelOf(event.actor_id, actors)}</p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
