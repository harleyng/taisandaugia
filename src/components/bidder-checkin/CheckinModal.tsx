import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Khung modal của luồng điểm danh (design san-checkin.js `.scm`): rộng 440px, bo
 * 2xl, tiêu đề + dòng phụ nhỏ, nút đóng ô vuông xám. Ẩn nút X mặc định của
 * shadcn (con cuối của DialogContent) để dùng nút của design.
 */
export function CheckinModal({
  open,
  onOpenChange,
  title,
  sub,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rỗng ⇒ chỉ còn nút đóng (màn "Điểm danh thành công"); vẫn có tiêu đề ẩn cho trình đọc màn hình. */
  title: string;
  sub?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(440px,94vw)] max-w-none flex-col gap-3.5 overflow-y-auto rounded-2xl border-0 px-[22px] pb-[22px] pt-5 shadow-[0_24px_60px_rgb(15_23_42/.25)] sm:rounded-2xl [&>*]:shrink-0 [&>button:last-child]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className={title ? "text-[17px] font-semibold leading-snug" : "sr-only"}>
              {title || "Điểm danh"}
            </DialogTitle>
            {sub ? (
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">{sub}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">Điểm danh dự phiên đấu giá</DialogDescription>
            )}
          </div>
          <DialogClose
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Hộp nhãn–giá trị trong modal (design `.kv`). */
export function ModalKv({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted p-3 text-[13px]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="min-w-0 text-right text-foreground">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
