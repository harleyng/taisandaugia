import { FileText, ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useKycImageUrl } from "@/hooks/useKycProfile";
import { cn } from "@/lib/utils";

interface Props {
  /** Đường dẫn trong bucket buyer-kyc. */
  path: string;
  alt: string;
  className?: string;
  /** Bấm để mở ảnh gốc ở tab mới (URL ký 10 phút). */
  openable?: boolean;
}

/**
 * Ảnh / PDF trong bucket PRIVATE buyer-kyc qua URL ký. Người mua chỉ đọc được tệp
 * của mình, tổ chức chỉ đọc được tệp của hồ sơ đã thanh toán — không có quyền thì
 * hiện ô "Không xem được".
 */
export function KycImageThumb({ path, alt, className, openable = true }: Props) {
  const { data: url, isLoading, isError } = useKycImageUrl(path);
  const box = cn("overflow-hidden rounded-lg border border-border bg-muted", className);

  if (isLoading) return <Skeleton className={cn("rounded-lg", className)} />;
  if (isError || !url) {
    return (
      <div className={cn(box, "flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground")}>
        <ImageOff className="h-5 w-5" />
        Không xem được tệp
      </div>
    );
  }

  const body = path.toLowerCase().endsWith(".pdf") ? (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
      <FileText className="h-6 w-6 text-primary" />
      Tệp PDF
    </div>
  ) : (
    <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
  );

  if (!openable) return <div className={box}>{body}</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={cn(box, "block transition-opacity hover:opacity-90")} title="Mở ảnh gốc">
      {body}
    </a>
  );
}
