import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { POSITION_LABELS, type Position } from "@/types/auctioneer";
import type { CpdOrgRow } from "@/lib/reports/cpdReport";
import { progressHours } from "@/lib/personnel/cpd";
import { CpdProofBadge, CpdStatusBadge } from "@/components/cpd/CpdStatusBadge";

interface Props {
  orgs: CpdOrgRow[];
  loading?: boolean;
  /** Số dòng bị RPC cắt — nói ra, không im lặng như thể đã phủ hết. */
  truncated?: boolean;
  cap?: number;
}

const PAGE_SIZE = 20;

export default function CpdOrgDetailTable({ orgs, loading, truncated, cap }: Props) {
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />;
  }

  const pages = Math.max(1, Math.ceil(orgs.length / PAGE_SIZE));
  const slice = orgs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5 pb-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-foreground">Chi tiết theo tổ chức</p>
          <p className="text-xs text-muted-foreground">
            Xếp tổ chức có tỉ lệ tuân thủ thấp nhất lên đầu. Bấm để xem từng đấu giá viên.
          </p>
        </div>
        {truncated && (
          <p className="text-xs text-warning">
            Danh sách đã bị cắt ở {cap?.toLocaleString("vi-VN")} đấu giá viên — thu hẹp
            bộ lọc để xem phần còn lại.
          </p>
        )}
      </div>

      {orgs.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
          Chưa có dữ liệu khớp bộ lọc
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="w-8" />
                <th className="text-left font-medium px-3 py-2.5">Tổ chức</th>
                <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">Tỉnh/thành</th>
                <th className="text-right font-medium px-3 py-2.5">ĐGV</th>
                <th className="text-right font-medium px-3 py-2.5">Đạt</th>
                <th className="text-right font-medium px-3 py-2.5">Chưa xong</th>
                <th className="text-right font-medium px-3 py-2.5">Miễn</th>
                <th className="text-right font-medium px-3 py-2.5">Tỉ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {slice.map((o) => {
                const open = expanded === o.organizationId;
                const pending = o.summary.short + o.summary.overdue;
                return (
                  <Fragment key={o.organizationId}>
                    <tr className="hover:bg-muted/30">
                      <td className="px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setExpanded(open ? null : o.organizationId)}
                          aria-label={open ? "Thu gọn" : "Xem đấu giá viên"}
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{o.orgName}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                        {o.province}
                      </td>
                      <td className="px-3 py-2.5 text-right">{o.summary.total}</td>
                      <td className="px-3 py-2.5 text-right text-success">{o.summary.met}</td>
                      <td className={`px-3 py-2.5 text-right ${pending > 0 ? "text-warning" : ""}`}>
                        {pending}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">
                        {o.summary.exempt}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {Math.round(o.summary.ratio * 100)}%
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div className="bg-muted/30 divide-y">
                            {o.people.map((p) => (
                              <div key={p.auctioneerId} className="flex items-center gap-3 px-6 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{p.fullName}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {[
                                      POSITION_LABELS[p.position as Position] ?? p.position,
                                      p.licenseNumber ? `Thẻ ${p.licenseNumber}` : "",
                                      p.isExempt ? "" : `${progressHours(p)}/${p.required} giờ`,
                                    ].filter(Boolean).join(" · ")}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                  <CpdStatusBadge ev={p} />
                                  <CpdProofBadge ev={p} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t">
          <p className="text-xs text-muted-foreground">
            Trang {page + 1}/{pages} · {orgs.length} tổ chức
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
