import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { actionOf, headlineOf, noteOf } from "@/lib/biddingContracts/buyerContract";
import { myContractPath } from "@/lib/biddingContracts/paths";
import { registeredLotsOf, type MyContract } from "@/hooks/useBuyerContracts";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import { TagPill } from "./ui";
import { useBuyerAction } from "./useBuyerAction";

/** Một hồ sơ trong "Hồ sơ của tôi" (design `.mr`): ảnh, mã, phiên, lịch, trạng thái, nút việc tiếp theo. */
interface Props {
  contract: MyContract;
  wonCount: number;
  now: Date;
  /** Điểm danh / phiếu dự phiên mở modal ngay trên danh sách. */
  onDialog: (kind: "checkin" | "ticket", c: MyContract) => void;
}

export function MyContractRow({ contract: c, wonCount, now, onDialog }: Props) {
  const navigate = useNavigate();
  const act = useBuyerAction();
  const s = c.auction_sessions;
  const ctx = { now, wonCount };
  const action = actionOf(c, ctx);
  const note = noteOf(c, ctx);
  const image = registeredLotsOf(c).find((l) => l.image_url)?.image_url ?? null;
  const venue = s?.auction_format === "truc_tiep" && s.venue ? ` · ${s.venue}` : "";

  return (
    <article
      className="grid cursor-pointer grid-cols-[88px_minmax(0,1fr)] items-center gap-4 rounded-2xl bg-card p-3 transition-shadow hover:shadow-[0_8px_20px_rgb(16_24_40/.08)] md:grid-cols-[132px_minmax(0,1fr)_200px]"
      onClick={() => navigate(myContractPath(c.code))}
    >
      <div className="h-[66px] w-[88px] overflow-hidden rounded-[10px] bg-muted md:h-[88px] md:w-[132px]">
        {image && <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono">{c.code}</span>
          {s?.code && <span>· {s.code}</span>}
        </div>
        <h3 className="my-0.5 text-[15px] font-semibold leading-snug text-foreground">{s?.title ?? "Phiên đấu giá"}</h3>
        {s && (
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <CalendarDays className="h-[15px] w-[15px] shrink-0" />
            <span>
              {formatDateTime(s.starts_at)} · {AUCTION_FORMAT_LABELS[s.auction_format] ?? s.auction_format}
              {venue}
            </span>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          <TagPill tag={headlineOf(c, ctx)} />
          {note && (
            <span className={cn("text-[13px]", note.warn ? "text-[hsl(var(--tier-warn-fg))]" : "text-foreground")}>
              {note.text}
            </span>
          )}
        </div>
      </div>
      <div className="col-span-full md:col-span-1">
        <Button
          size="sm"
          variant={action.primary ? "default" : "secondary"}
          className={cn("h-8 w-full", !action.primary && "bg-primary/10 text-primary shadow-none hover:bg-primary/15")}
          onClick={(e) => {
            e.stopPropagation();
            if (action.kind === "checkin" || action.kind === "ticket") onDialog(action.kind, c);
            else act(action.kind, c);
          }}
        >
          {action.label}
        </Button>
      </div>
    </article>
  );
}
