import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SaleContractsTable } from "@/components/portal/sale-contracts/SaleContractsTable";
import { useSessionOrg } from "@/hooks/useAuctionSessions";
import { useOrgSaleContracts } from "@/hooks/useSaleContracts";
import {
  ALL_SESSIONS, ALL_STAGES, EMPTY_SALE_FILTERS, filterSaleContracts, saleStageCounts,
  type SaleFilters,
} from "@/lib/saleContracts/filters";
import { SALE_STAGE_LABELS, type SaleAssetSnapshot, type SaleStage } from "@/types/auction-sale-contract";

const STAT_STAGES: SaleStage[] = ["signing", "paying", "handover", "completed"];

/** /portal/hop-dong-mua-ban — hợp đồng mua bán tài sản đấu giá của tổ chức. */
export default function HopDongMuaBanPage() {
  const [searchParams] = useSearchParams();
  const { organizationId, loading: orgLoading } = useSessionOrg();
  const { data: rows = [], isLoading, error } = useOrgSaleContracts(organizationId);
  const [filters, setFilters] = useState<SaleFilters>(() => ({
    ...EMPTY_SALE_FILTERS,
    sessionId: searchParams.get("session") ?? ALL_SESSIONS,
  }));

  // Danh sách phiên lấy từ chính hợp đồng: người chỉ có quyền hợp đồng (không
  // có quyền phiên) vẫn lọc được.
  const sessions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const a = (r.asset_snapshot ?? {}) as SaleAssetSnapshot;
      if (!map.has(r.session_id)) map.set(r.session_id, a.session_code ?? r.session_id.slice(0, 8));
    }
    return [...map.entries()];
  }, [rows]);

  const counts = useMemo(() => saleStageCounts(rows), [rows]);
  const visible = useMemo(() => filterSaleContracts(rows, filters), [rows, filters]);

  const set = (patch: Partial<SaleFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-6 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Hợp đồng mua bán</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lập hợp đồng với người trúng đấu giá, theo dõi thanh toán và bàn giao tài sản.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_STAGES.map((s) => (
          <Card key={s} className="rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">{SALE_STAGE_LABELS[s]}</p>
            <p className="mt-1 text-2xl font-semibold">{counts[s]}</p>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl">
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="sale-q">Tìm kiếm</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="sale-q"
                className="pl-8"
                value={filters.q}
                placeholder="Mã hợp đồng, tài sản, bên mua…"
                onChange={(e) => set({ q: e.target.value })}
              />
            </div>
          </div>

          <div className="w-40 space-y-1.5">
            <Label htmlFor="sale-session">Phiên</Label>
            <Select value={filters.sessionId} onValueChange={(v) => set({ sessionId: v })}>
              <SelectTrigger id="sale-session">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SESSIONS}>Tất cả phiên</SelectItem>
                {sessions.map(([id, code]) => (
                  <SelectItem key={id} value={id}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-44 space-y-1.5">
            <Label htmlFor="sale-stage">Giai đoạn</Label>
            <Select
              value={filters.stage}
              onValueChange={(v) => set({ stage: v as SaleFilters["stage"] })}
            >
              <SelectTrigger id="sale-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STAGES}>Tất cả</SelectItem>
                {(Object.keys(SALE_STAGE_LABELS) as SaleStage[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SALE_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
              checked={filters.overdueOnly}
              onChange={(e) => set({ overdueOnly: e.target.checked })}
            />
            Chỉ quá hạn
          </label>
        </div>

        {orgLoading || isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Đang tải hợp đồng…
          </div>
        ) : error ? (
          <p className="px-4 py-10 text-center text-sm text-destructive">
            Không tải được danh sách hợp đồng. Vui lòng thử lại.
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Chưa có hợp đồng mua bán nào. Hợp đồng được lập từ trang điều hành phiên sau khi chốt kết quả.
          </p>
        ) : (
          <SaleContractsTable rows={visible} />
        )}
      </Card>
    </div>
  );
}
