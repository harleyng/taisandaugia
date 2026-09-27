import { UploadCloud } from "lucide-react";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { cn } from "@/lib/utils";

const PARENT_ICON = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.icon]));

interface PostingThumbProps {
  /** Ảnh đầu tiên của hồ sơ (bucket public), null khi chưa có ảnh. */
  src: string | null | undefined;
  parentSlug: string;
  /** Kích thước + bo góc do nơi dùng quyết định. */
  className?: string;
  iconClassName?: string;
}

/** Ảnh đại diện của hồ sơ; chưa có ảnh thì là ô xám với icon nhóm tài sản. */
export function PostingThumb({ src, parentSlug, className, iconClassName }: PostingThumbProps) {
  const Icon = PARENT_ICON[parentSlug] ?? UploadCloud;
  if (src) {
    return <img src={src} alt="" loading="lazy" className={cn("shrink-0 bg-muted object-cover", className)} />;
  }
  return (
    <div className={cn("grid shrink-0 place-items-center bg-muted text-muted-foreground", className)} aria-hidden="true">
      <Icon className={cn("h-5 w-5", iconClassName)} strokeWidth={1.5} />
    </div>
  );
}
