import { format } from "date-fns";
import { Check, ChevronRight, Clock, ExternalLink, FileText, Hash, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { KG_TRACK, type KgStatus } from "@/lib/consignment/ownerConsignmentView";
import { PostingThumb } from "@/components/asset-posting/digitize/PostingThumb";
import type { AssetPosting } from "@/types/asset-posting";

const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

interface KgDetailHeaderProps {
  posting: AssetPosting;
  status: KgStatus;
  /** Ngày xong của từng bước KG_TRACK (dd/MM), null khi chưa xong / không rõ. */
  stepDates: (string | null)[];
  /** Lần chuyển động gần nhất của luồng ký gửi. */
  updatedAt: string;
  onBack: () => void;
  onOpenDigitized: () => void;
  /** Có hợp đồng dịch vụ ⇒ hiện nút "Xem hợp đồng". */
  onViewContract?: () => void;
}

/** Breadcrumb + thẻ đầu trang: ảnh, loại, tên, dữ kiện nhận dạng, thanh 3 bước. */
export function KgDetailHeader({
  posting: p,
  status: s,
  stepDates,
  updatedAt,
  onBack,
  onOpenDigitized,
  onViewContract,
}: KgDetailHeaderProps) {
  const location = [p.district, p.province].filter(Boolean).join(", ");
  const err = s.tone === "err";

  return (
    <>
      <nav aria-label="Đường dẫn" className="mb-4 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
        <button type="button" onClick={onBack} className="shrink-0 text-foreground/70 hover:text-foreground hover:underline">
          Ký gửi đấu giá
        </button>
        <ChevronRight className="h-[13px] w-[13px] shrink-0" aria-hidden="true" />
        <span className="truncate font-medium text-foreground" aria-current="page">
          {p.title}
        </span>
      </nav>

      <section className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="flex flex-wrap items-start gap-5 px-5 py-5 sm:flex-nowrap sm:px-6 sm:py-[22px]">
          <PostingThumb
            src={p.image_urls?.[0]}
            parentSlug={p.parent_slug}
            className="h-40 w-full rounded-[10px] sm:h-[92px] sm:w-[120px]"
            iconClassName="h-7 w-7"
          />

          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[12.5px] font-medium text-muted-foreground">{CHILD_LABEL[p.child_slug] ?? p.child_slug}</p>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground [text-wrap:pretty]">{p.title}</h1>
            <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-foreground/70">
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {location}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] tabular-nums">
                <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Mã hồ sơ </span>
                {p.code}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                Cập nhật {format(new Date(updatedAt), "dd/MM/yyyy")}
              </span>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
            {onViewContract && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onViewContract}>
                Xem hợp đồng
                <ExternalLink className="h-[13px] w-[13px]" />
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenDigitized}>
              <FileText className="h-3.5 w-3.5" />
              Hồ sơ số hoá
            </Button>
          </div>
        </div>

        <ol className="flex border-t border-border px-5 pb-3.5 pt-4 sm:px-6" aria-label="Tiến trình ký gửi">
          {KG_TRACK.map((label, i) => {
            const done = i < s.step;
            const cur = i === s.step;
            const note = done ? (stepDates[i] ?? "Xong") : cur ? (s.mine ? "Đến lượt bạn" : "Đang diễn ra") : "";
            return (
              <li
                key={label}
                aria-current={cur ? "step" : undefined}
                className="relative flex min-w-0 flex-1 flex-col items-start gap-1.5"
              >
                {i < KG_TRACK.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute left-6 right-1.5 top-2.5 h-0.5", done ? "bg-primary" : "bg-border")}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-[1] grid h-[22px] w-[22px] place-items-center rounded-full border-2 bg-card text-primary-foreground",
                    done && "border-primary bg-primary",
                    cur && !err && "border-primary ring-4 ring-primary/15",
                    cur && err && "border-destructive ring-4 ring-destructive/15",
                    !done && !cur && "border-input",
                  )}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "pr-2 text-[11px] font-medium sm:text-[12.5px]",
                    done ? "text-foreground/70" : cur ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                  {done && <span className="sr-only"> (đã xong)</span>}
                </span>
                <span
                  className={cn(
                    "min-h-[17px] text-[11.5px] tabular-nums",
                    cur ? (err ? "font-semibold text-destructive" : "font-semibold text-primary") : "text-muted-foreground",
                  )}
                >
                  {note}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
