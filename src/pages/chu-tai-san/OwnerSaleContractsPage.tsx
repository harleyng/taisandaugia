import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OwnerSaleContractsTable } from "@/components/owner-portal/sale-contracts/OwnerSaleContractsTable";
import { useOwnerSaleContracts } from "@/hooks/useSaleContracts";
import {
  OWNER_SALE_TABS, filterOwnerSaleContracts, ownerSaleTabCounts, type OwnerSaleTab,
} from "@/lib/saleContracts/ownerTabs";

const EMPTY_TEXT: Record<OwnerSaleTab, string> = {
  action: "Không có hợp đồng nào đang chờ bạn xử lý.",
  active: "Không có hợp đồng nào đang thực hiện.",
  completed: "Chưa có hợp đồng nào hoàn tất.",
  cancelled: "Không có hợp đồng nào bị huỷ.",
};

/**
 * /chu-tai-san/hop-dong-mua-ban — hợp đồng mà chủ tài sản là BÊN BÁN.
 *
 * Chỉ hiện với lô đến từ hồ sơ ký gửi: lô tin đăng có bên bán là thực thể danh
 * bạ không có tài khoản, tổ chức ký thay nên không có gì để chủ tài sản làm.
 */
export default function OwnerSaleContractsPage() {
  const { data: rows = [], isLoading, error } = useOwnerSaleContracts();
  const counts = useMemo(() => ownerSaleTabCounts(rows), [rows]);
  // Chưa chọn tab ⇒ mở "Cần bạn xử lý" nếu có việc, không thì "Đang thực hiện".
  const [picked, setPicked] = useState<OwnerSaleTab | null>(null);
  const tab: OwnerSaleTab = picked ?? (counts.action > 0 ? "action" : "active");
  const [q, setQ] = useState("");

  const visible = useMemo(() => filterOwnerSaleContracts(rows, tab, q), [rows, tab, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Hợp đồng mua bán</h1>
        <p className="text-sm text-muted-foreground">
          Hợp đồng bán tài sản của bạn cho người trúng đấu giá. Xác nhận bản ký, theo dõi thanh toán và bàn giao
          ngay tại đây.
        </p>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center gap-2 rounded-2xl p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Đang tải hợp đồng…
        </Card>
      ) : error ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-destructive">
          Không tải được danh sách hợp đồng. Vui lòng thử lại.
        </Card>
      ) : rows.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Bạn chưa có hợp đồng mua bán nào. Sau khi tài sản đấu giá thành, tổ chức đấu giá sẽ lập hợp đồng và gửi
          cho bạn tại đây.
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {OWNER_SALE_TABS.map((t) => (
              <Button
                key={t.key}
                variant={tab === t.key ? "default" : "outline"}
                size="sm"
                onClick={() => setPicked(t.key)}
                className="gap-1.5"
              >
                {t.label}
                {t.key === "action" && counts.action > 0 ? (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                    {counts.action}
                  </span>
                ) : (
                  <span className={tab === t.key ? "opacity-80" : "text-muted-foreground"}>{counts[t.key]}</span>
                )}
              </Button>
            ))}
          </div>

          <Card className="rounded-2xl">
            <div className="border-b p-4">
              <div className="relative max-w-sm">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  aria-label="Tìm hợp đồng"
                  className="pl-8"
                  value={q}
                  placeholder="Mã hợp đồng, tài sản, bên mua…"
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <OwnerSaleContractsTable
              rows={visible}
              emptyText={q ? "Không có hợp đồng nào khớp từ khoá." : EMPTY_TEXT[tab]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
