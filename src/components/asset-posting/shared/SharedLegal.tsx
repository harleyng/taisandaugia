import { Check, CircleHelp, Info, Landmark, Lock, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SharedPostingLegal } from "@/lib/postingShare/types";
import { legalItems, type LegalTone } from "@/lib/postingShare/view";
import { ShareCard } from "./sharedParts";

const TONE: Record<LegalTone, { box: string; dot: string; note: string; icon: typeof Check }> = {
  ok: { box: "border-border", dot: "bg-success/10 text-success", note: "text-muted-foreground", icon: Check },
  warn: { box: "border-warning/30 bg-warning/10", dot: "bg-card text-warning", note: "text-foreground/75", icon: Info },
  muted: { box: "border-border", dot: "bg-muted text-muted-foreground", note: "text-muted-foreground", icon: CircleHelp },
};

/** Pháp lý do chủ tài sản tự khai, dạng lưới 2 cột. Giấy tờ gốc KHÔNG công khai. */
export function SharedLegal({ legal }: { legal: SharedPostingLegal }) {
  return (
    <ShareCard
      title="Tình trạng pháp lý"
      icon={Landmark}
      aux={
        <>
          <PenLine className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
          Chủ tài sản tự khai
        </>
      }
    >
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {legalItems(legal).map((it) => {
          const t = TONE[it.tone];
          const Icon = t.icon;
          return (
            <li key={it.title} className={cn("flex gap-3 rounded-[14px] border p-3.5", t.box)}>
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", t.dot)}>
                <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <b className="block text-[14.5px] font-semibold text-foreground">{it.title}</b>
                <span className={cn("text-[13px]", t.note)}>{it.note}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3.5 flex items-start gap-2.5 text-[13.5px] text-muted-foreground">
        <Lock className="mt-px h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={1.6} aria-hidden="true" />
        <span>Giấy tờ pháp lý gốc được cung cấp khi bạn mua hồ sơ tham gia đấu giá.</span>
      </p>
    </ShareCard>
  );
}
