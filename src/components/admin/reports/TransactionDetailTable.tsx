import { useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/lib/advertising/slug";
import type { DetailRow } from "@/lib/reports/transactionReport";

interface Props {
  rows: DetailRow[];
}

type KindFilter = "all" | "topup" | "spend";

const PAGE_SIZE = 15;

const FILTERS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "topup", label: "Nạp tiền" },
  { key: "spend", label: "Tiêu dùng" },
];

const dtf = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
    active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground",
  ].join(" ");

export default function TransactionDetailTable({ rows }: Props) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (!needle) return true;
      return (
        r.userName.toLowerCase().includes(needle) ||
        r.userEmail.toLowerCase().includes(needle) ||
        r.label.toLowerCase().includes(needle)
      );
    });
  }, [rows, kind, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const resetPage = () => setPage(0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Chi tiết giao dịch</p>
          <p className="text-xs text-muted-foreground">Ai nạp/tiêu, bao nhiêu — {filtered.length.toLocaleString("vi-VN")} giao dịch</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setKind(f.key);
                resetPage();
              }}
              className={pill(kind === f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            resetPage();
          }}
          placeholder="Tìm theo tên, email, tính năng…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="h-24 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
          Chưa có giao dịch nào
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{dtf.format(new Date(r.at))}</TableCell>
                    <TableCell className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[220px]">{r.userName}</p>
                      {r.userEmail && r.userEmail !== r.userName && (
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">{r.userEmail}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={[
                          "inline-block rounded-md px-2 py-0.5 text-xs font-medium",
                          r.kind === "topup" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        {r.kind === "topup" ? "Nạp tiền" : "Tiêu dùng"}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">{r.label}</span>
                    </TableCell>
                    <TableCell
                      className={[
                        "text-right tabular-nums font-medium",
                        r.credits > 0 ? "text-green-600" : "text-foreground",
                      ].join(" ")}
                    >
                      {r.credits > 0 ? "+" : ""}
                      {r.credits.toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {r.kind === "topup" ? (r.vndKnown ? formatVnd(r.vnd) : "—") : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Trang {safePage + 1}/{pageCount}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <button
                  onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
