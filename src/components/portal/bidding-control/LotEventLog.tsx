import {
  Ban,
  Banknote,
  FileText,
  Flag,
  Gavel,
  HandCoins,
  Lock,
  Mail,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Scale,
  TimerReset,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailCard, DetailRow, DetailRows } from "@/components/portal/auction-sessions/DetailCard";
import { FilterDropdown, FilterOption } from "@/components/portal/auction-sessions/list/FilterDropdown";
import { cn } from "@/lib/utils";
import { actorLabelOf, describeLotEvent, type ActorSources } from "@/lib/bidding/lotEventText";
import { LOT_EVENT_LABELS, type LotEvent, type LotEventKind } from "@/types/auction-bidding";

/**
 * Nhật ký điều hành — cột trái dưới sân khấu (ngoài design, người dùng giữ lại
 * 18/10). Mỗi loại bước một biểu tượng + màu riêng; số lô là badge cạnh nhãn để
 * dò nhanh lô nào.
 *
 * Lọc theo loại thao tác + tài sản (18/10): thay cho "Lịch sử trả giá" đã bỏ
 * khỏi sân khấu — chọn "Trả giá" + một tài sản là ra lịch sử trả giá lô đó. Lọc
 * thuần phía client trên đúng danh sách đã tải. Khi phiên đang diễn ra, lọc tài
 * sản MẶC ĐỊNH là lô đang đấu / tạm dừng và đi theo lô đó khi lô kế tiếp mở —
 * cho đến khi người dùng tự chọn một giá trị khác.
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
  accept: [HandCoins, OK],
  sealed_bid: [Mail, INFO],
  tie: [Scale, WARN],
  tie_round: [Repeat, INFO],
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
  /** Lô đang đấu / tạm dừng — mặc định của bộ lọc tài sản; null ⇒ "Mọi tài sản". */
  currentLotId: string | null;
}

/** Giá trị lọc tài sản: "all" | "session" (sự kiện cấp phiên) | id lô. */
type LotFilter = string;
const SESSION_LEVEL = "session";

export function LotEventLog({ events, isLoading, lotNoById, actors, currentLotId }: Props) {
  const [kind, setKind] = useState<LotEventKind | "all">("all");
  // null = chưa tự chọn ⇒ theo lô đang đấu (nếu có).
  const [pickedLot, setPickedLot] = useState<LotFilter | null>(null);
  const lot: LotFilter = pickedLot ?? currentLotId ?? "all";
  const [openMenu, setOpenMenu] = useState<"kind" | "lot" | null>(null);

  // Chỉ đưa vào lựa chọn những loại / tài sản thật sự có trong nhật ký.
  const kinds = useMemo(() => {
    const present = new Set(events?.map((e) => e.kind));
    return (Object.keys(LOT_EVENT_LABELS) as LotEventKind[]).filter((k) => present.has(k));
  }, [events]);
  const lotOptions = useMemo(
    () => [...lotNoById.entries()].sort((a, b) => a[1] - b[1]),
    [lotNoById],
  );
  const hasSessionLevel = !!events?.some((e) => !e.lot_id);

  const shown = useMemo(
    () =>
      (events ?? []).filter(
        (e) =>
          (kind === "all" || e.kind === kind) &&
          (lot === "all" || (lot === SESSION_LEVEL ? !e.lot_id : e.lot_id === lot)),
      ),
    [events, kind, lot],
  );
  const filtered = kind !== "all" || lot !== "all";

  const kindLabel = kind === "all" ? "Mọi thao tác" : LOT_EVENT_LABELS[kind];
  const lotLabel =
    lot === "all" ? "Mọi tài sản" : lot === SESSION_LEVEL ? "Cấp phiên" : `Tài sản ${lotNoById.get(lot) ?? "?"}`;

  const pickKind = (k: LotEventKind | "all") => {
    setKind(k);
    setOpenMenu(null);
  };
  const pickLot = (l: LotFilter) => {
    setPickedLot(l);
    setOpenMenu(null);
  };

  return (
    <DetailCard
      title="Nhật ký điều hành"
      aside={events?.length ? <span className="tabular-nums">{shown.length}/{events.length} dòng</span> : undefined}
    >
      {!!events?.length && (
        <div className="flex flex-wrap items-center gap-2 px-[22px] pb-1 pt-2">
          <FilterDropdown
            label={kindLabel}
            aria-label="Lọc theo loại thao tác"
            open={openMenu === "kind"}
            onOpenChange={(o) => setOpenMenu(o ? "kind" : null)}
          >
            <FilterOption selected={kind === "all"} onSelect={() => pickKind("all")}>
              Mọi thao tác
            </FilterOption>
            {kinds.map((k) => (
              <FilterOption key={k} selected={kind === k} onSelect={() => pickKind(k)}>
                {LOT_EVENT_LABELS[k]}
              </FilterOption>
            ))}
          </FilterDropdown>
          <FilterDropdown
            label={lotLabel}
            aria-label="Lọc theo tài sản"
            open={openMenu === "lot"}
            onOpenChange={(o) => setOpenMenu(o ? "lot" : null)}
          >
            <FilterOption selected={lot === "all"} onSelect={() => pickLot("all")}>
              Mọi tài sản
            </FilterOption>
            {lotOptions.map(([id, no]) => (
              <FilterOption key={id} selected={lot === id} onSelect={() => pickLot(id)}>
                Tài sản {no}
                {id === currentLotId && <span className="ml-1.5 text-[hsl(var(--tier-info))]">· đang đấu</span>}
              </FilterOption>
            ))}
            <FilterOption hidden={!hasSessionLevel} selected={lot === SESSION_LEVEL} onSelect={() => pickLot(SESSION_LEVEL)}>
              Cấp phiên
            </FilterOption>
          </FilterDropdown>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setKind("all");
                setPickedLot("all");
              }}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Xoá lọc
            </button>
          )}
        </div>
      )}
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
      ) : !shown.length ? (
        <p className="px-[22px] pb-6 pt-4 text-center text-sm text-muted-foreground">
          Không có thao tác nào khớp bộ lọc.
        </p>
      ) : (
        <DetailRows className="max-h-[28rem] overflow-y-auto pb-3">
          {shown.map((event) => {
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
