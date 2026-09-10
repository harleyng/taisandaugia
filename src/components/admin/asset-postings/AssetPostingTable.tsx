import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { ASSET_POSTING_STATUS_LABELS } from "@/types/asset-posting";
import { ReviewStatusBadge } from "./ReviewStatusBadge";
import type { AdminAssetPosting } from "@/hooks/useAdminAssetPostings";

const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

interface Props {
  rows: AdminAssetPosting[];
  onOpen: (row: AdminAssetPosting) => void;
}

export function AssetPostingTable({ rows, onOpen }: Props) {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Không có hồ sơ nào</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tài sản</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Chủ tài sản</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Khu vực</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cập nhật</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Hồ sơ</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Duyệt</th>
            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className={i < rows.length - 1 ? "border-b border-border" : ""}>
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">{row.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {CHILD_LABEL[row.child_slug] ?? row.child_slug}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">{row.profiles?.name ?? "—"}</p>
                <p className="text-[11px] text-muted-foreground">{row.profiles?.email ?? ""}</p>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.province ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true, locale: vi })}
              </td>
              <td className="px-4 py-3">
                <span className="text-[11px] text-muted-foreground">
                  {ASSET_POSTING_STATUS_LABELS[row.status] ?? row.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <ReviewStatusBadge status={row.review_status} />
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onOpen(row)}>
                  Xem hồ sơ
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
