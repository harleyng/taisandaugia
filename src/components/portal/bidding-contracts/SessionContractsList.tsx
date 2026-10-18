import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotPill } from "@/components/portal/auction-sessions/list/SessionStatePill";
import {
  DEPOSIT_PILL,
  REVIEW_FILTERS,
  REVIEW_PILL,
  depositFilterOptions,
  filterTabContracts,
  formatDayMonthTime,
  rowActionOf,
  type DepositFilter,
  type ReviewFilter,
} from "@/lib/biddingContracts/contractDetail";
import { maskIdNumber } from "@/lib/biddingContracts/filters";
import { sessionContractPath } from "@/lib/biddingContracts/paths";
import { cn } from "@/lib/utils";
import { ID_TYPE_LABELS, type ContractWithSession } from "@/types/bidding-contract";

const TH =
  "whitespace-nowrap border-b bg-muted/40 px-3.5 py-[11px] text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground";
const TD = "border-b px-3.5 py-[13px] align-middle";
const SM_BTN = "h-8 rounded-lg px-[11px] text-[12.5px] font-semibold";

interface Props {
  sessionId: string;
  sessionCancelled: boolean;
  rows: ContractWithSession[];
  isLoading: boolean;
  emptyText: string;
}

/**
 * Bảng hồ sơ tham gia của một phiên (design `contractsTab`): chip lọc trạng thái
 * duyệt, lọc tiền đặt trước, ô tìm và bảng. Bấm một dòng mở trang chi tiết hồ sơ.
 */
export function SessionContractsList({ sessionId, sessionCancelled, rows, isLoading, emptyText }: Props) {
  const navigate = useNavigate();
  const [review, setReview] = useState<ReviewFilter>("all");
  const [deposit, setDeposit] = useState<DepositFilter>("all");
  const [q, setQ] = useState("");

  const shown = useMemo(() => filterTabContracts(rows, review, deposit, q), [rows, review, deposit, q]);
  const reviewCount = (k: ReviewFilter) => (k === "all" ? rows.length : rows.filter((r) => r.review_status === k).length);
  const depositOptions = depositFilterOptions(rows);
  const open = (c: ContractWithSession, dep = false) =>
    navigate(`${sessionContractPath(sessionId, c.code)}${dep ? "?ghi-nhan=dat-truoc" : ""}`);

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3 pl-[22px] pr-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo trạng thái duyệt">
          {REVIEW_FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === review}
              onClick={() => setReview(k)}
              className={cn(
                "h-[30px] rounded-full px-[11px] text-[12.5px] font-semibold transition-colors",
                k === review ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {label} <span className="ml-0.5 tabular-nums opacity-75">{reviewCount(k)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-8 items-center gap-1.5 rounded-lg bg-card pl-2.5 pr-1 text-[12.5px] text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]">
            <span>Đặt trước</span>
            <select
              value={deposit}
              onChange={(e) => setDeposit(e.target.value as DepositFilter)}
              className="h-[30px] cursor-pointer border-0 bg-transparent text-[13px] font-medium text-foreground outline-none"
            >
              {depositOptions.map(([k, label, n]) => (
                <option key={k} value={k}>
                  {label} ({n})
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-[34px] w-[240px] max-w-full items-center gap-2 rounded-lg px-3 text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] focus-within:shadow-[0_0_0_2px_hsl(var(--primary))]">
            <Search className="h-[18px] w-[18px] shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tên, SĐT, mã hồ sơ"
              aria-label="Tìm hồ sơ"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className={cn(TH, "pl-[22px]")}>Hồ sơ</th>
              <th className={TH}>Người đăng ký</th>
              <th className={cn(TH, "hidden lg:table-cell")}>Giấy tờ</th>
              <th className={TH}>Duyệt hồ sơ</th>
              <th className={TH}>Tiền đặt trước</th>
              <th className={cn(TH, "pr-[18px]")} aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Đang tải hồ sơ" />
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  {rows.length === 0 ? emptyText : "Không có hồ sơ nào ở nhóm này."}
                </td>
              </tr>
            ) : (
              shown.map((c) => {
                const action = rowActionOf(c, sessionCancelled);
                const rv = REVIEW_PILL[c.review_status];
                const dp = DEPOSIT_PILL[c.deposit_status];
                return (
                  <tr
                    key={c.id}
                    onClick={() => open(c)}
                    className="cursor-pointer [&:hover>td]:bg-primary/[0.03] [&:last-child>td]:border-b-0"
                  >
                    <td className={cn(TD, "whitespace-nowrap pl-[22px]")}>
                      <b className="block font-mono text-[12.5px] font-medium">{c.code}</b>
                      <small className="block text-xs tabular-nums text-muted-foreground">
                        Nộp {formatDayMonthTime(c.paid_at)}
                      </small>
                    </td>
                    <td className={cn(TD, "max-w-[300px]")}>
                      <b className="block truncate font-semibold">{c.org_name ?? c.full_name}</b>
                      <small className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {c.org_name && `ĐDPL: ${c.full_name} · `}
                        {c.phone}
                      </small>
                    </td>
                    <td className={cn(TD, "hidden whitespace-nowrap lg:table-cell")}>
                      <span className="font-mono text-[12.5px]">{maskIdNumber(c.id_number)}</span>
                      <small className="block text-xs text-muted-foreground">{ID_TYPE_LABELS[c.id_type]}</small>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-col items-start gap-1">
                        <DotPill tone={rv.tone}>{rv.label}</DotPill>
                        {c.review_status === "pending" && c.resubmitted_at && (
                          <small className="text-xs text-muted-foreground">Đã nộp lại</small>
                        )}
                      </div>
                    </td>
                    <td className={TD}>
                      <DotPill tone={dp.tone}>{dp.label}</DotPill>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap pr-[18px] text-right")} onClick={(e) => e.stopPropagation()}>
                      {action === "review" ? (
                        <Button size="sm" className={SM_BTN} onClick={() => open(c)}>
                          Xem & duyệt
                        </Button>
                      ) : action === "deposit" ? (
                        <Button size="sm" variant="outline" className={SM_BTN} onClick={() => open(c, true)}>
                          Ghi nhận đặt trước
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => open(c)}
                          className="py-1 text-[13px] font-semibold text-primary hover:text-primary/80"
                        >
                          Xem chi tiết
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
