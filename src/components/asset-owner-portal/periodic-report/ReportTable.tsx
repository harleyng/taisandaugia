import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "screen" = trong cổng; "print" = trang in A4 (không rút gọn, không tooltip);
 * "shared" = link chia sẻ /r/:token — màn hình như "screen" (mobile xếp chồng), nhưng
 * bảng desktop luôn đủ dòng và in ra như "print" (người nhận có thể in từ trình duyệt).
 */
export type ReportVariant = "screen" | "print" | "shared";

export interface ReportColumn<T> {
  label: string;
  render: (row: T) => ReactNode;
  /** Cột số: căn phải, chữ số đều. */
  numeric?: boolean;
  className?: string;
}

interface ReportTableProps<T> {
  /** Cột đầu là cột tên tài sản — ở dạng xếp chồng (mobile) nó thành tiêu đề của dòng. */
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  variant: ReportVariant;
  /** Số dòng hiện trước khi bấm "Xem thêm" (chỉ trên màn hình; bản in luôn đủ). */
  pageSize?: number;
}

/**
 * Bảng chi tiết (tầng L4) của báo cáo định kỳ. Bản in: bảng thật — tiêu đề cột lặp
 * lại mỗi trang, một dòng không bị cắt ngang trang. Dưới md: các dòng xếp chồng.
 */
export function ReportTable<T>({ columns, rows, rowKey, variant, pageSize = 20 }: ReportTableProps<T>) {
  const [limit, setLimit] = useState(pageSize);
  const print = variant === "print";
  const shared = variant === "shared";
  // Danh sách xếp chồng (mobile) rút gọn; bảng của bản in / link chia sẻ luôn đủ dòng.
  const listRows = print ? rows : rows.slice(0, limit);
  const tableRows = print || shared ? rows : listRows;
  const [first, ...rest] = columns;

  return (
    <div className="text-sm">
      <table
        className={cn(
          "w-full border-collapse",
          print ? "table text-xs" : shared ? "hidden md:table print:table print:text-xs" : "hidden md:table",
        )}
      >
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={cn("whitespace-nowrap px-2 py-2 font-normal first:pl-0 last:pr-0", c.numeric && "text-right", c.className)}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {tableRows.map((row, i) => (
            <tr key={rowKey(row, i)} className="break-inside-avoid align-top">
              {columns.map((c) => (
                <td
                  key={c.label}
                  className={cn(
                    "px-2 py-2 first:pl-0 last:pr-0",
                    c.numeric && "whitespace-nowrap text-right tabular-nums",
                    c.className,
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {!print && (
        <ul className={cn("divide-y md:hidden", shared && "print:hidden")}>
          {listRows.map((row, i) => (
            <li key={rowKey(row, i)} className="space-y-1.5 py-3">
              <div>{first.render(row)}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {rest.map((c) => (
                  <div key={c.label} className="min-w-0">
                    <dt className="text-muted-foreground">{c.label}</dt>
                    <dd className={cn("min-w-0 text-foreground", c.numeric && "tabular-nums")}>{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}

      {!print && rows.length > limit && (
        <div className={cn("pt-3 text-center", shared && "md:hidden print:hidden")}>
          <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + pageSize)}>
            Xem thêm {Math.min(pageSize, rows.length - limit)} dòng
          </Button>
        </div>
      )}
    </div>
  );
}

/** Ô tên tài sản: tên + mã (hoặc "Ngoài sàn") + chi nhánh. */
export function AssetCell({
  title,
  code,
  branchName,
}: {
  title: string;
  code: string | null;
  branchName?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="line-clamp-2 font-medium text-foreground">{title}</p>
      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
        {code ? (
          <span>
            Mã <span className="font-mono tracking-wide text-foreground/80">{code}</span>
          </span>
        ) : (
          <span>Ngoài sàn</span>
        )}
        {branchName && <span className="truncate">{branchName}</span>}
      </p>
    </div>
  );
}
