import { cn } from "@/lib/utils";

interface AssetLineProps {
  title: string;
  /** "Mã 3F9A12BC" (8 hex đầu của tin); null ⇒ tài sản ngoài sàn. */
  code: string | null;
  /** Các mẩu phụ (đơn vị, chi nhánh, ngày…) — bỏ qua mẩu rỗng. */
  sub?: (string | null | undefined)[];
  className?: string;
}

/** Tên tài sản + mã + dòng phụ mờ, dùng chung cho các bảng của trang Dòng tiền. */
export function AssetLine({ title, code, sub = [], className }: AssetLineProps) {
  const extra = sub.filter((s): s is string => !!s);
  return (
    <div className={cn("min-w-0", className)}>
      <p className="line-clamp-2 font-medium text-foreground">{title}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {code ? (
          <>
            Mã <span className="font-mono tracking-wide text-foreground/80">{code}</span>
          </>
        ) : (
          "Ngoài sàn"
        )}
        {extra.length > 0 && ` · ${extra.join(" · ")}`}
      </p>
    </div>
  );
}
