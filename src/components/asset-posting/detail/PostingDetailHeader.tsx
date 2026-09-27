import type { ReactNode } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarDays, Copy, GitBranch, Handshake, Hash, MapPin, MoreVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import type { AssetPosting } from "@/types/asset-posting";
import { PostingThumb } from "../digitize/PostingThumb";

const PARENT_NAME: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.name]));
const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

interface PostingDetailHeaderProps {
  posting: AssetPosting;
  branch: string | null;
  /** Có ⇒ hiện nút "Chỉnh sửa" (mở lại wizard). */
  onEdit?: () => void;
  /** Có ⇒ menu ⋯ có mục mở trang ký gửi. */
  onOpenConsignment?: () => void;
  /** Dải tiến trình (PostingFlowStrip) nằm ở đáy thẻ. */
  children: ReactNode;
}

/** Đầu trang chi tiết hồ sơ: ảnh chính, loại, tên, vài dữ kiện nhận dạng + dải tiến trình. */
export function PostingDetailHeader({ posting: p, branch, onEdit, onOpenConsignment, children }: PostingDetailHeaderProps) {
  const location = [p.address, p.ward, p.district, p.province].filter(Boolean).join(", ");
  const code = p.code;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Đã sao chép mã ${code}`);
    } catch {
      toast.error("Không sao chép được. Vui lòng thử lại.");
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="flex flex-wrap items-start gap-5 px-5 py-5 sm:flex-nowrap sm:px-6 sm:py-[22px]">
        <PostingThumb
          src={p.image_urls?.[0]}
          parentSlug={p.parent_slug}
          className="h-40 w-full rounded-[10px] sm:h-[92px] sm:w-[120px]"
          iconClassName="h-7 w-7"
        />

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[12.5px] font-medium text-muted-foreground">
            {PARENT_NAME[p.parent_slug] ?? p.parent_slug} · {CHILD_LABEL[p.child_slug] ?? p.child_slug}
          </p>
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
              {code}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              Tạo {format(new Date(p.created_at), "dd/MM/yyyy", { locale: vi })}
            </span>
            {branch && (
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {branch}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Chỉnh sửa
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2.5 text-muted-foreground" aria-label="Thêm thao tác">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={copyCode} className="gap-2">
                <Copy className="h-4 w-4" />
                Sao chép mã hồ sơ
              </DropdownMenuItem>
              {onOpenConsignment && (
                <DropdownMenuItem onSelect={onOpenConsignment} className="gap-2">
                  <Handshake className="h-4 w-4" />
                  Mở trang ký gửi đấu giá
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {children}
    </section>
  );
}
