import { Tabs, TabsContent } from "@/components/ui/tabs";
import { MarketingCrumb } from "@/components/asset-owner-portal/marketing/campaigns/MarketingCrumb";
import { DataFlowLevelView } from "@/components/asset-owner-portal/marketing/data-flow/DataFlowLevelView";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerTabsList, OwnerTabsTrigger } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { DATA_FLOW_LEVELS } from "@/lib/ownerMarketing/dataFlow";

const DEFAULTS = { muc: "l0" };
const ALLOWED = { muc: DATA_FLOW_LEVELS.map((l) => l.key) };

/**
 * "Dữ liệu đi đâu" — /chu-tai-san/truyen-thong/du-lieu (owner-marketing Phase M6, §A5).
 * Trang tĩnh: dữ liệu nào vào sàn, dữ liệu nào không, lưu ở đâu — theo mức L0 / L1 / L2.
 * Nội dung ở src/lib/ownerMarketing/dataFlow.ts.
 */
export default function OwnerMarketingDataFlowPage() {
  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <MarketingCrumb trail={[{ label: "Dữ liệu đi đâu" }]} />
        <OwnerPageHeader
          title="Dữ liệu đi đâu"
          subtitle="Ở chế độ mặc định, danh sách khách hàng của ngân hàng không rời khỏi ngân hàng — sàn chỉ đếm lượt bấm ẩn danh."
        />
      </div>

      <Tabs value={f.muc} onValueChange={(v) => setFilter("muc", v)} className="space-y-5">
        <OwnerTabsList aria-label="Mức triển khai">
          {DATA_FLOW_LEVELS.map((l) => (
            <OwnerTabsTrigger key={l.key} value={l.key}>
              {l.code} · {l.short}
            </OwnerTabsTrigger>
          ))}
        </OwnerTabsList>
        {DATA_FLOW_LEVELS.map((l) => (
          <TabsContent key={l.key} value={l.key} className="mt-0">
            <DataFlowLevelView level={l} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
