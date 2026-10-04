import { Phone } from "lucide-react";
import type { SharedPosting } from "@/lib/postingShare/types";
import { formatSharePhone, initialsOf } from "@/lib/postingShare/view";
import { InitialsMark } from "./sharedParts";

/** Đơn vị chủ tài sản + cán bộ gửi link (khi link cho hiện liên hệ). Ẩn nếu không có gì để hiện. */
export function SharedSenderCard({ posting: p, onCall }: { posting: SharedPosting; onCall: () => void }) {
  const sender = p.sender;
  if (!p.ownerName && !sender?.name && !sender?.phone) return null;

  return (
    <section className="rounded-2xl bg-card p-[18px] shadow-card sm:p-[22px]">
      <h2 className="mb-3 text-[15px] font-semibold text-foreground">Liên hệ</h2>
      {p.ownerName && (
        <div className="flex items-center gap-3">
          <InitialsMark
            text={initialsOf(p.ownerName)}
            className="h-12 w-12 rounded-xl bg-primary text-[13px] text-primary-foreground"
          />
          <div className="min-w-0">
            <b className="block text-[15px] font-semibold leading-snug text-foreground">{p.ownerName}</b>
            <span className="text-[13px] text-muted-foreground">Chủ tài sản</span>
          </div>
        </div>
      )}
      {sender?.name && (
        <div className={`flex items-center gap-3 rounded-xl bg-muted p-3 ${p.ownerName ? "mt-3.5" : ""}`}>
          <InitialsMark
            text={initialsOf(sender.name)}
            className="h-[38px] w-[38px] rounded-full bg-primary/10 text-[13px] font-semibold text-primary"
          />
          <div className="min-w-0">
            <b className="block text-sm font-semibold text-foreground">{sender.name}</b>
            <span className="text-[12.5px] text-muted-foreground">{p.ownerName ? "Cán bộ phụ trách" : "Người gửi hồ sơ"}</span>
          </div>
        </div>
      )}
      {sender?.phone && (
        <a
          href={`tel:${sender.phone}`}
          onClick={onCall}
          className="mt-3 flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
        >
          <Phone className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
          Gọi {formatSharePhone(sender.phone)}
        </a>
      )}
    </section>
  );
}
