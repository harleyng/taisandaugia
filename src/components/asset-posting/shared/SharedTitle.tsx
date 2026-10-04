import { BadgeCheck, MapPin, ShieldCheck } from "lucide-react";
import { CHILD_NAME, PARENT_NAME } from "@/constants/category.constants";
import type { SharedPosting } from "@/lib/postingShare/types";
import { sharedLocation } from "@/lib/postingShare/view";

const BADGE = "inline-flex h-[30px] items-center gap-1.5 rounded-full bg-primary/10 px-3 text-[13px] font-semibold text-primary";

/**
 * Nhóm tài sản, tên, vị trí và nhãn tin cậy. Link chỉ tạo được cho hồ sơ đã duyệt ⇒ nhãn duyệt
 * luôn đúng; tin trên sàn mang nhãn "Tin đấu giá trên sàn".
 */
export function SharedTitle({ posting: p }: { posting: SharedPosting }) {
  const location = sharedLocation(p);
  const category = [PARENT_NAME[p.category.parent], CHILD_NAME[p.category.child]].filter(Boolean).join(" · ");

  return (
    <div>
      {category && <p className="text-xs font-semibold uppercase tracking-[0.07em] text-primary">{category}</p>}
      <h1 className="mb-2.5 mt-1.5 text-[22px] font-bold leading-tight tracking-[-0.01em] text-foreground sm:text-[28px]">
        {p.title}
      </h1>
      {location && (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-[3px] h-[15px] w-[15px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>{location}</span>
        </p>
      )}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <span className={BADGE}>
          <ShieldCheck className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
          {p.kind === "listing" ? "Tin đấu giá trên sàn" : "Hồ sơ đã được sàn duyệt"}
        </span>
        {p.authenticated && (
          <span className={BADGE}>
            <BadgeCheck className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
            Đã giám định
          </span>
        )}
      </div>
    </div>
  );
}
