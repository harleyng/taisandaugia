import type { ReactNode } from "react";
import { ChevronRight, Clock, FileText, Hash, ImageOff, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StepperView } from "@/lib/contracts/detailView";
import { fullDay } from "@/lib/contracts/detailView";
import { ContractStepper } from "./ContractStepper";

interface ContractDetailHeaderProps {
  /** "Hợp đồng ký gửi đấu giá" / "Hợp đồng dịch vụ · VR tour 360°". */
  eyebrow: string;
  title: string;
  code: string | null;
  location: string | null;
  updatedAt: string | null;
  imageUrl: string | null;
  status?: ReactNode;
  stepper: StepperView;
  mine: boolean;
  onBack: () => void;
  /** Mở hồ sơ số hoá của tài sản; null khi không có hồ sơ. */
  onOpenPosting: (() => void) | null;
}

/** Đường dẫn "Hợp đồng › mã · tài sản" + thẻ đầu trang (ảnh, tên tài sản, mã / nơi / cập nhật) + thanh bước. */
export function ContractDetailHeader({
  eyebrow,
  title,
  code,
  location,
  updatedAt,
  imageUrl,
  status,
  stepper,
  mine,
  onBack,
  onOpenPosting,
}: ContractDetailHeaderProps) {
  return (
    <>
      <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
        <button type="button" onClick={onBack} className="shrink-0 hover:text-foreground">
          Hợp đồng
        </button>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate font-semibold text-foreground">
          {code ?? "Chưa có mã"} · {title}
        </span>
      </nav>

      <section className="rounded-2xl bg-card shadow-card">
        <div className="grid gap-5 px-6 py-[22px] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
          <div className="grid h-[120px] w-full place-items-center overflow-hidden rounded-[10px] bg-muted md:h-[84px] md:w-28">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <ImageOff className="h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              {eyebrow}
              {status}
            </p>
            <h1 className="mt-0.5 text-pretty text-[23px] font-bold tracking-tight text-foreground">{title}</h1>
            <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Hash className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
                <span className="font-mono text-[12.5px]">{code ?? "Chưa có mã"}</span>
              </span>
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
                  {location}
                </span>
              )}
              {updatedAt && (
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Clock className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
                  Cập nhật {fullDay(updatedAt)}
                </span>
              )}
            </div>
          </div>
          {onOpenPosting && (
            <Button variant="outline" className="gap-1.5 justify-self-start" onClick={onOpenPosting}>
              <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Hồ sơ số hoá
            </Button>
          )}
        </div>
        <ContractStepper view={stepper} mine={mine} />
      </section>
    </>
  );
}
