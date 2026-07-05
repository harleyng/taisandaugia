import { Loader2, Plus, UploadCloud, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { ASSET_POSTING_STATUS_LABELS, type AssetPostingStatus } from "@/types/asset-posting";
import { formatPrice } from "@/utils/formatters";
import { useMyPostings } from "@/hooks/useAssetPosting";

// parent slug → icon component
const PARENT_ICON = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.icon]));
// child slug → tên loại
const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

const STATUS_STYLE: Record<AssetPostingStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning",
  matched: "bg-primary/10 text-primary",
  contracted: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

interface AssetPostingsLandingProps {
  onCreate: () => void;
  onSelect: (id: string) => void;
}

/** Trang "Số hoá tài sản": danh sách hồ sơ đấu giá của tôi + CTA tạo mới. */
export function AssetPostingsLanding({ onCreate, onSelect }: AssetPostingsLandingProps) {
  const { data: postings, isLoading } = useMyPostings();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Tài sản đăng đấu giá</h1>
          <p className="text-sm text-muted-foreground">
            Số hóa hồ sơ tài sản và gửi yêu cầu tới tổ chức đấu giá phù hợp.
          </p>
        </div>
        <Button onClick={onCreate} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          Số hoá tài sản
        </Button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !postings || postings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center border border-dashed border-border rounded-2xl">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <UploadCloud className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Chưa có tài sản nào</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Bắt đầu số hóa hồ sơ tài sản đầu tiên để nhận gợi ý tổ chức đấu giá phù hợp.
            </p>
          </div>
          <Button onClick={onCreate} variant="outline" className="gap-1.5 mt-1">
            <Plus className="h-4 w-4" />
            Số hoá tài sản
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {postings.map((p) => {
            const Icon = PARENT_ICON[p.parent_slug] ?? UploadCloud;
            const location = [p.district, p.province].filter(Boolean).join(", ");
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className="w-full text-left flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 hover:border-primary/40 transition-colors"
              >
                <div className="h-11 w-11 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {CHILD_LABEL[p.child_slug] ?? p.child_slug}
                    {location ? ` · ${location}` : ""}
                  </p>
                </div>

                <div className="hidden sm:block text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">
                    {p.starting_price ? formatPrice(p.starting_price, "TOTAL") : "Nhờ định giá"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Giá khởi điểm</p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLE[p.status]}`}
                >
                  {ASSET_POSTING_STATUS_LABELS[p.status]}
                </span>

                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 hidden sm:block" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
