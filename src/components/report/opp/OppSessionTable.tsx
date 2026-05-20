import { useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockSessions, type SessionRow } from "@/lib/mockOppReport";

const PAGE_SIZE = 5;

const typeBadge: Record<string, string> = {
  bds: "bg-primary/10 text-primary",
  oto: "bg-amber-100 text-amber-700",
  tsc: "bg-blue-100 text-blue-700",
  mm: "bg-blue-100 text-blue-700",
};

const legalBadge: Record<string, string> = {
  tha: "bg-orange-100 text-orange-700",
  npl: "bg-red-100 text-red-700",
  thuong: "bg-blue-100 text-blue-700",
  tl: "bg-amber-100 text-amber-700",
};

interface OppSessionTableProps {
  locked: boolean;
  onRowClick: (session: SessionRow) => void;
}

export const OppSessionTable = ({ locked, onRowClick }: OppSessionTableProps) => {
  const [page, setPage] = useState(1);
  const total = mockSessions.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const rows = mockSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mt-4">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-wrap gap-2">
        <h4 className="font-serif font-semibold text-base">Danh sách 47 phiên khớp tiêu chí</h4>
        <span className="font-mono text-[10.5px] text-muted-foreground">sắp xếp: ngày tổ chức gần nhất</span>
      </div>

      <div className="relative">
        {/* Table */}
        <div className={cn("overflow-x-auto", locked && "blur-[3px] opacity-50 pointer-events-none select-none")}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60">
                {["Tài sản", "Loại", "Pháp lý", "Giá KĐ", "Chủ tài sản", "Cty đấu giá", "Ngày tổ chức", ""].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-4 py-2.5 text-[9.5px] font-mono font-semibold uppercase tracking-wider text-muted-foreground text-left border-b border-border whitespace-nowrap",
                      (i === 3) && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => !locked && onRowClick(row)}
                  className="border-b border-border hover:bg-primary/5 cursor-pointer transition-colors last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-xs text-foreground">{row.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{row.loc} {row.area !== "—" ? `· ${row.area}` : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded", typeBadge[row.typeId])}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded", legalBadge[row.legalId])}>
                      {row.legal}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-right text-xs">{row.price}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{row.owner}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{row.auctioneer}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{row.date}</div>
                    <div className="text-[10px] text-primary font-semibold mt-0.5">còn {row.daysLeft} ngày</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-right">›</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Lock overlay */}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[6px] rounded-b-xl">
            <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm">
              <Lock className="h-4 w-4" />
              Mở khoá để xem danh sách phiên
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 bg-muted/30">
        <span className="text-xs text-muted-foreground">
          Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total} phiên
        </span>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => !locked && setPage(p)}
              className={cn(
                "w-7 h-7 rounded-md border text-xs font-mono font-semibold transition-colors",
                p === page
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary hover:text-primary",
              )}
            >
              {p}
            </button>
          ))}
          {totalPages > 5 && (
            <>
              <button className="w-7 h-7 rounded-md border border-border text-xs text-muted-foreground">…</button>
              <button
                onClick={() => !locked && setPage(totalPages)}
                className={cn("w-7 h-7 rounded-md border text-xs font-mono font-semibold transition-colors", page === totalPages ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary hover:text-primary")}
              >
                {totalPages}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
