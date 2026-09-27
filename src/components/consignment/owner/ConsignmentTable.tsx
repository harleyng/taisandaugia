import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { ownerConsignmentPath } from "@/lib/consignment/ownerConsignment";
import type { OwnerConsignmentRow } from "@/hooks/useOwnerConsignments";
import { PostingThumb } from "@/components/asset-posting/digitize/PostingThumb";
import { ConsignmentOrgsCell } from "./OrgDots";
import { KgNextCell, KgStatusLabel, KgTrackBar } from "./KgStatusParts";

const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

/** 6 cột ở màn rộng; màn hẹp gập thành 2 cột + các dòng phụ (như thiết kế). */
const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2.5 px-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_72px_16px] xl:gap-5 xl:px-[18px]";

interface ConsignmentTableProps {
  rows: OwnerConsignmentRow[];
  branchLabel: Map<string, string>;
  emptyText: string;
}

/** Bảng hồ sơ ký gửi: mỗi dòng là một link sang chi tiết (mở tab mới được). */
export function ConsignmentTable({ rows, branchLabel, emptyText }: ConsignmentTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div
        aria-hidden="true"
        className={cn(
          GRID,
          "hidden border-b border-border bg-muted/40 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground xl:grid",
        )}
      >
        <span>Tài sản</span>
        <span>Tổ chức</span>
        <span>Trạng thái</span>
        <span>Bước tiếp theo</span>
        <span className="text-right">Cập nhật</span>
        <span />
      </div>

      {rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const p = r.posting;
            const location = [p.district, p.province].filter(Boolean).join(", ");
            const branch = p.branch_id ? branchLabel.get(p.branch_id) : null;
            const meta = [CHILD_LABEL[p.child_slug] ?? p.child_slug, location, branch].filter(Boolean).join(" · ");
            return (
              <li key={p.id}>
                <Link
                  to={ownerConsignmentPath(p.id)}
                  className={cn(
                    GRID,
                    "group py-3.5 transition-colors hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  )}
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-[13px] xl:col-span-1">
                    <PostingThumb src={p.image_urls?.[0]} parentSlug={p.parent_slug} className="h-11 w-14 rounded-[7px]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
                      <p className="truncate text-[12.5px] text-muted-foreground">{meta}</p>
                    </div>
                  </div>

                  <ConsignmentOrgsCell row={r} />

                  <div>
                    <KgStatusLabel status={r.kg} />
                    <KgTrackBar step={r.kg.step} />
                  </div>

                  <div className="col-span-2 xl:col-span-1">
                    <KgNextCell status={r.kg} line={r.nextLine} />
                  </div>

                  <p className="text-[12.5px] tabular-nums text-muted-foreground xl:text-right">
                    <span className="xl:sr-only">Cập nhật </span>
                    {r.lastActivityAt ? format(new Date(r.lastActivityAt), "dd/MM") : "—"}
                  </p>

                  <ChevronRight
                    className="hidden h-4 w-4 text-border transition-colors group-hover:text-primary xl:block"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
