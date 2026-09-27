import { Tabs } from "@/components/ui/tabs";
import { OwnerTabsList, OwnerTabsTrigger } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { LEDGER_TABS, LEDGER_TAB_LABEL, ledgerMoney, type LedgerTab } from "@/lib/ownerOutcomesLedger";

interface LedgerTabsProps {
  tab: LedgerTab;
  onChange: (tab: LedgerTab) => void;
  counts: Record<LedgerTab, number>;
  /** Tổng giá trúng + tỷ lệ thành trong phạm vi lọc (bỏ qua tab). */
  soldValue: number;
  successRate: number | null;
  panelId: string;
}

/** Thanh tab của sổ + tóm tắt "Đã bán · Tỷ lệ thành" bên phải. Tab Cần xử lý tô vàng khi còn việc. */
export function LedgerTabs({ tab, onChange, counts, soldValue, successRate, panelId }: LedgerTabsProps) {
  return (
    <div className="-mx-5 -mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 shadow-[inset_0_-1px_0_hsl(var(--border))]">
      {/* Đường kẻ chạy tràn thẻ nằm ở khung ngoài (bóng inset, gạch chân tab vẽ đè lên)
          ⇒ bỏ đường kẻ riêng của danh sách tab. Panel là khối role="tabpanel"
          id={panelId} của trang (không dùng TabsContent). */}
      <Tabs value={tab} onValueChange={(v) => v && onChange(v as LedgerTab)} className="min-w-0">
        <OwnerTabsList aria-label="Nhóm kết quả" className="shadow-none">
          {LEDGER_TABS.map((k) => (
            <OwnerTabsTrigger key={k} value={k} count={counts[k]} attention={k === "todo"} aria-controls={panelId}>
              {LEDGER_TAB_LABEL[k]}
            </OwnerTabsTrigger>
          ))}
        </OwnerTabsList>
      </Tabs>
      <div className="flex flex-wrap items-baseline gap-x-[18px] gap-y-1.5 pb-1 text-[13px] tabular-nums text-muted-foreground">
        <span>
          Đã bán <b className="text-[15px] text-foreground">{ledgerMoney(soldValue)}</b>
        </span>
        <span>
          Tỷ lệ thành <b className="text-[15px] text-foreground">{successRate ?? 0}%</b>
        </span>
      </div>
    </div>
  );
}
