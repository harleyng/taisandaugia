import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { formatMoneyShort } from "@/utils/money";
import { digitizeNextLine } from "@/lib/asset-posting/digitizeStatus";
import type { DigitizePostingRow } from "@/hooks/useOwnerDigitizedPostings";
import { DigitizeNextCell, DigitizeStatusLabel, DigitizeTrackBar } from "./DigitizeStatusParts";
import { PostingThumb } from "./PostingThumb";

const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

/** 6 cột ở màn rộng; màn hẹp gập thành 2 cột (tài sản | giá) + các dòng phụ. */
const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2.5 px-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_20px] xl:gap-5 xl:px-[18px]";

export interface DigitizeTableMarks {
  with3d?: Set<string>;
  withVr?: Set<string>;
  authenticated?: Set<string>;
}

interface DigitizeTableProps {
  rows: DigitizePostingRow[];
  hrefOf: (postingId: string) => string;
  marks: DigitizeTableMarks;
  branchLabel: Map<string, string>;
  /** Khi lọc/tìm ra rỗng. */
  emptyText: string;
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-[5px] border border-border px-[5px] text-[10.5px] font-semibold leading-[17px] text-foreground/70">
      {children}
    </span>
  );
}

/** Bảng hồ sơ số hoá: mỗi dòng là một link sang chi tiết (mở tab mới được). */
export function DigitizeTable({ rows, hrefOf, marks, branchLabel, emptyText }: DigitizeTableProps) {
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
        <span>Khu vực</span>
        <span>Trạng thái</span>
        <span>Bước tiếp theo</span>
        <span className="text-right">Giá khởi điểm</span>
        <span />
      </div>

      {rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const p = r.posting;
            const has3d = marks.with3d?.has(p.id);
            const hasVr = marks.withVr?.has(p.id);
            const isAuth = marks.authenticated?.has(p.id);
            const branch = p.branch_id ? branchLabel.get(p.branch_id) : null;
            const location = [p.district, p.province].filter(Boolean).join(", ");
            return (
              <li key={p.id}>
                <Link
                  to={hrefOf(p.id)}
                  className={cn(
                    GRID,
                    "group py-3.5 transition-colors hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-[13px]">
                    <PostingThumb src={p.image_urls?.[0]} parentSlug={p.parent_slug} className="h-11 w-14 rounded-[7px]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
                      <p className="truncate text-[12.5px] text-muted-foreground">
                        {CHILD_LABEL[p.child_slug] ?? p.child_slug}
                        {branch ? ` · ${branch}` : ""}
                      </p>
                      {(has3d || hasVr || isAuth) && (
                        <div className="mt-[5px] flex flex-wrap items-center gap-[5px]">
                          {has3d && <Chip>3D</Chip>}
                          {hasVr && <Chip>VR tour</Chip>}
                          {isAuth && <Chip>Đã giám định</Chip>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-[13px] leading-snug text-muted-foreground xl:col-span-1">
                    {location || "—"}
                  </div>

                  <div>
                    <DigitizeStatusLabel status={r.status} />
                    <DigitizeTrackBar step={r.status.step} />
                  </div>

                  <div className="col-span-2 xl:col-span-1">
                    <DigitizeNextCell status={r.status} line={digitizeNextLine(r.status, r)} />
                  </div>

                  <div className="col-start-2 row-start-1 text-right xl:col-start-auto xl:row-start-auto">
                    <span className="sr-only">Giá khởi điểm: </span>
                    {p.starting_price ? (
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatMoneyShort(p.starting_price)}
                      </span>
                    ) : (
                      <span className="text-[13px] font-medium text-muted-foreground">
                        {r.status.stage === "draft" ? "—" : "Nhờ định giá"}
                      </span>
                    )}
                  </div>

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
