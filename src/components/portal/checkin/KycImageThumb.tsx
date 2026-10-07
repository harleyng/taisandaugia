import { FileText, ImageOff, Loader2 } from "lucide-react";
import { useKycImageUrl } from "@/hooks/useKycProfile";

interface Props {
  path: string | null | undefined;
  label: string;
}

/**
 * Ảnh giấy tờ trong bucket riêng buyer-kyc (URL ký 10 phút). Bấm để mở cỡ thật ở
 * tab mới. PDF (giấy uỷ quyền / ĐKKD) hiện thành ô tệp.
 */
export function KycImageThumb({ path, label }: Props) {
  const { data: url, isLoading, isError } = useKycImageUrl(path);
  const isPdf = !!path && /\.pdf$/i.test(path);

  const body = !path ? (
    <span className="text-xs text-muted-foreground">Không có ảnh</span>
  ) : isLoading ? (
    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  ) : isError || !url ? (
    <ImageOff className="h-5 w-5 text-muted-foreground" />
  ) : isPdf ? (
    <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
      <FileText className="h-6 w-6" />
      Mở tệp PDF
    </span>
  ) : (
    <img src={url} alt={label} className="h-full w-full object-cover" />
  );

  return (
    <figure className="space-y-1">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-[1.58] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted hover:border-primary"
        >
          {body}
        </a>
      ) : (
        <div className="flex aspect-[1.58] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
          {body}
        </div>
      )}
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}
