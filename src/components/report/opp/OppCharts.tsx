import { useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  areaHeatmapData, priceHistogramData,
  assetTypeDonut, legalTypeDonut,
  top5Owners, top5Auctioneers,
  weeklySchedule,
  bdsPricePerSqm, bdsAreaHistogram, bdsScatterData,
} from "@/lib/mockOppReport";

// ---- helpers ----
const heatClass = (level: 0 | 1 | 2 | 3 | 4) => {
  switch (level) {
    case 4: return "bg-primary text-primary-foreground";
    case 3: return "bg-primary/60 text-primary-foreground";
    case 2: return "bg-primary/30 text-primary";
    case 1: return "bg-primary/15 text-primary/70";
    default: return "bg-muted text-muted-foreground";
  }
};

// ---- Chart card wrapper ----
const ChartCard = ({ title, tag, sub, n, children, locked, className }: {
  title: React.ReactNode;
  tag?: string;
  sub?: string;
  n?: string;
  children: React.ReactNode;
  locked: boolean;
  className?: string;
}) => (
  <div className={cn("bg-card border border-border rounded-xl overflow-hidden shadow-sm relative", className)}>
    <div className="px-5 py-3.5 border-b border-border flex items-start justify-between gap-4">
      <div>
        <h4 className="font-serif font-semibold text-sm flex items-center gap-2 flex-wrap">
          {title}
          {tag && (
            <span className="font-mono text-[9px] bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground uppercase tracking-wider font-semibold">
              {tag}
            </span>
          )}
        </h4>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {n && <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">{n}</span>}
    </div>
    <div className="relative">
      <div className={cn("px-5 py-4", locked && "blur-[3px] opacity-50 pointer-events-none select-none")}>
        {children}
      </div>
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[6px] rounded-b-xl">
          <div className="flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
            <Lock className="h-3.5 w-3.5" />
            Mở khoá để xem chi tiết
          </div>
        </div>
      )}
    </div>
  </div>
);

const Insight = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground leading-relaxed">
    {children}
  </div>
);

// ---- Chart 1: Area heatmap ----
const AreaHeatmap = ({ locked }: { locked: boolean }) => (
  <ChartCard title="Phân bố theo khu vực" tag="#1" sub="Mật độ phiên theo tỉnh/thành phố" n="14 khu vực" locked={locked}>
    <div className="grid grid-cols-7 gap-1.5">
      {areaHeatmapData.map((d, i) => (
        <div key={i} className={cn("aspect-square rounded flex items-center justify-center font-mono text-[10px] font-semibold", heatClass(d.level))}>
          {d.label}
        </div>
      ))}
    </div>
    <Insight>💡 Nguồn cung tập trung mạnh ở <strong className="text-primary">2 khu vực trung tâm</strong>. Vùng ven gần như không có.</Insight>
  </ChartCard>
);

// ---- Chart 2: Price histogram ----
const PriceHistogram = ({ locked, unit }: { locked: boolean; unit: "count" | "value" }) => (
  <ChartCard title="Phân bố theo phân khúc giá" tag="#2" sub="Số phiên theo khoảng giá khởi điểm" n="n = 47" locked={locked}>
    <div className="flex items-end gap-2 h-36 pt-4">
      {priceHistogramData.map((d, i) => {
        const val = unit === "count" ? d.count : d.value;
        const maxVal = unit === "count" ? Math.max(...priceHistogramData.map((x) => x.count)) : Math.max(...priceHistogramData.map((x) => x.value));
        const pct = Math.round((val / maxVal) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <div
              className={cn("w-full rounded-t relative", d.peak ? "bg-gradient-to-b from-amber-400 to-amber-600" : "bg-gradient-to-b from-primary/70 to-primary")}
              style={{ height: `${pct}%` }}
            >
              <span className="absolute -top-4 left-0 right-0 text-center font-mono text-[10px] font-semibold text-muted-foreground">{val}</span>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground text-center leading-tight whitespace-pre-line">{d.range}</span>
          </div>
        );
      })}
    </div>
    <Insight>💡 <strong className="text-primary">75% nguồn cung</strong> nằm dưới 5 tỷ. Tầm tiền này nhiều lựa chọn — cạnh tranh cũng cao hơn.</Insight>
  </ChartCard>
);

// ---- Donut helper ----
const DonutChart = ({ data, total }: { data: typeof assetTypeDonut; total: number }) => {
  let cumulative = 0;
  const gradient = data.map((d) => {
    const start = cumulative;
    cumulative += d.pct;
    return `${d.color} ${start}% ${cumulative}%`;
  }).join(", ");

  return (
    <div className="flex items-center gap-5">
      <div className="w-28 h-28 rounded-full relative flex-shrink-0" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-[22px] bg-card rounded-full flex flex-col items-center justify-center">
          <span className="font-serif font-semibold text-lg leading-none">{total}</span>
          <span className="font-mono text-[9px] text-muted-foreground">phiên</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="text-muted-foreground flex-1">{d.label}</span>
            <span className="font-mono font-semibold">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Chart 3: Asset type donut ----
const AssetTypeDonut = ({ locked }: { locked: boolean }) => (
  <ChartCard title="Cơ cấu theo loại tài sản" tag="#3" sub="Tỷ trọng nguồn cung" n="4 loại" locked={locked}>
    <DonutChart data={assetTypeDonut} total={47} />
    <Insight>💡 BĐS chiếm hơn nửa nguồn cung. Tài sản công ít nhưng giá trị cao.</Insight>
  </ChartCard>
);

// ---- Chart 4: Legal type donut ----
const LegalTypeDonut = ({ locked }: { locked: boolean }) => (
  <ChartCard title="Cơ cấu theo loại pháp lý" tag="#4" sub="Nguồn gốc tài sản đưa ra đấu giá" n="4 nhóm" locked={locked}>
    <DonutChart data={legalTypeDonut} total={47} />
    <Insight>💡 <strong className="text-primary">42%</strong> nguồn cung là thi hành án — cần lưu ý rủi ro pháp lý.</Insight>
  </ChartCard>
);

// ---- Bar list helper ----
const BarList = ({ items }: { items: { name: string; count: number }[] }) => {
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <div key={i} className="grid items-center gap-2.5" style={{ gridTemplateColumns: "140px 1fr 40px" }}>
          <span className="text-xs text-muted-foreground font-medium truncate">{item.name}</span>
          <div className="h-5 bg-muted rounded overflow-hidden">
            <div
              className="h-full rounded"
              style={{
                width: `${Math.round((item.count / max) * 100)}%`,
                background: `linear-gradient(90deg, hsl(var(--primary) / ${1 - i * 0.15}), hsl(var(--primary) / ${0.9 - i * 0.15}))`,
              }}
            />
          </div>
          <span className="font-mono text-xs font-semibold text-right">{item.count}</span>
        </div>
      ))}
    </div>
  );
};

// ---- Chart 5: Top 5 ----
const Top5Chart = ({ locked }: { locked: boolean }) => {
  const [mode, setMode] = useState<"owner" | "auctioneer">("owner");
  return (
    <ChartCard
      title="Top đơn vị tham gia"
      tag="#5"
      sub={mode === "owner" ? "Top 5 chủ tài sản có nhiều phiên nhất" : "Top 5 công ty đấu giá tổ chức nhiều phiên nhất"}
      locked={locked}
    >
      <div className="flex justify-end mb-3">
        <div className="flex border border-border rounded-md overflow-hidden">
          {(["owner", "auctioneer"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "text-[10.5px] px-2.5 py-1 font-semibold border-r border-border last:border-r-0 transition-colors",
                mode === m ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {m === "owner" ? "Chủ tài sản" : "Cty ĐG"}
            </button>
          ))}
        </div>
      </div>
      <BarList items={mode === "owner" ? top5Owners : top5Auctioneers} />
      <Insight>💡 <strong className="text-primary">2 ngân hàng lớn</strong> chiếm gần 1/3 nguồn cung — chủ yếu nợ xấu.</Insight>
    </ChartCard>
  );
};

// ---- Chart 6: Weekly schedule heatmap ----
const WeeklyHeatmap = ({ locked }: { locked: boolean }) => (
  <ChartCard title="Lịch tổ chức theo tuần" tag="#6" sub="Số phiên / tuần" n="60 ngày" locked={locked}>
    <div className="flex flex-col gap-2">
      {weeklySchedule.map((week, wi) => (
        <div key={wi} className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] text-muted-foreground w-14 flex-shrink-0">{week.week}</span>
          <div className="flex gap-1.5 flex-1">
            {week.days.map((d, di) => (
              <div
                key={di}
                className={cn("flex-1 h-7 rounded flex items-center justify-center font-mono text-[10.5px] font-semibold", heatClass(d.level as 0 | 1 | 2 | 3 | 4))}
              >
                {d.count}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono text-muted-foreground flex-wrap">
      <span>Ít</span>
      {[0, 1, 2, 3, 4].map((l) => (
        <span key={l} className={cn("w-3.5 h-2.5 rounded-sm", heatClass(l as 0 | 1 | 2 | 3 | 4))} />
      ))}
      <span>Nhiều</span>
    </div>
    <Insight>💡 <strong className="text-primary">18/47 phiên</strong> dồn vào tuần 3. Chuẩn bị vốn &amp; hồ sơ trước tuần đó.</Insight>
  </ChartCard>
);

// ---- BDS Charts ----

const BdsPriceBar = ({ locked }: { locked: boolean }) => (
  <ChartCard title="Giá khởi điểm / m² theo khu vực" tag="#7 · BĐS" sub="Trung vị giá/m²" n="n = 25" locked={locked}>
    <BarList items={bdsPricePerSqm.map((d) => ({ name: d.area, count: d.price }))} />
    <Insight>💡 Chênh lệch giá KĐ/m² giữa khu vực đắt và rẻ nhất tới <strong className="text-primary">4×</strong>.</Insight>
  </ChartCard>
);

const BdsAreaHistogram = ({ locked, unit }: { locked: boolean; unit: "count" | "value" }) => (
  <ChartCard title="Phân bố diện tích" tag="#8 · BĐS" sub="Số phiên theo khoảng diện tích" n="n = 25" locked={locked}>
    <div className="flex items-end gap-2 h-36 pt-4">
      {bdsAreaHistogram.map((d, i) => {
        const maxVal = Math.max(...bdsAreaHistogram.map((x) => x.count));
        const pct = maxVal === 0 ? 0 : Math.round((d.count / maxVal) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <div
              className={cn("w-full rounded-t relative", d.peak ? "bg-gradient-to-b from-amber-400 to-amber-600" : "bg-gradient-to-b from-primary/70 to-primary")}
              style={{ height: `${Math.max(pct, 2)}%` }}
            >
              <span className="absolute -top-4 left-0 right-0 text-center font-mono text-[10px] font-semibold text-muted-foreground">{d.count}</span>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground text-center leading-tight whitespace-pre-line">{d.range}</span>
          </div>
        );
      })}
    </div>
    <Insight>💡 <strong className="text-primary">76% lô đất</strong> trong khoảng 100–200m². Lô lớn hiếm — chỉ 2 phiên.</Insight>
  </ChartCard>
);

const BdsScatter = ({ locked }: { locked: boolean }) => (
  <ChartCard title="Giá KĐ/m² của từng phiên vs mặt bằng khu vực" tag="#9 · BĐS" sub="Mỗi chấm là 1 phiên · chấm trên đường = cao hơn trung vị khu vực" n="n = 25" locked={locked} className="col-span-2">
    <div className="relative h-48 border-l border-b border-border">
      {/* median line */}
      <div className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/40" style={{ top: "50%" }}>
        <span className="absolute right-2 font-mono text-[9.5px] text-muted-foreground bg-card px-1 -translate-y-1/2">trung vị khu vực</span>
      </div>
      {bdsScatterData.map((d, i) => (
        <div
          key={i}
          className={cn(
            "absolute w-2.5 h-2.5 rounded-full border-2 border-white shadow cursor-pointer hover:scale-150 transition-transform",
            d.status === "above" ? "bg-destructive" : d.status === "below" ? "bg-amber-500" : "bg-primary",
          )}
          style={{ left: `${d.x}%`, top: `${d.y}%`, transform: "translate(-50%, -50%)" }}
        />
      ))}
    </div>
    <div className="flex justify-between font-mono text-[9px] text-muted-foreground mt-1 px-1">
      <span>Hóc Môn</span><span>Hà Đông</span><span>Q.7</span><span>Cầu Giấy</span><span>Q.1</span>
    </div>
    <div className="flex gap-4 mt-3 text-[10.5px] text-muted-foreground flex-wrap">
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block" />cao hơn trung vị</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />quanh trung vị</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />thấp hơn · tiềm năng deal</span>
    </div>
    <Insight>💡 <strong className="text-primary">4 phiên có giá KĐ/m² thấp hơn trung vị khu vực 20%+</strong> — đáng để ý.</Insight>
  </ChartCard>
);

// ---- Main export ----
interface OppChartsProps {
  locked: boolean;
  hasBds: boolean;
  unit: "count" | "value";
}

export const OppCharts = ({ locked, hasBds, unit }: OppChartsProps) => (
  <div className="space-y-4">
    <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-3 after:flex-1 after:h-px after:bg-border">
      Phân tích thị trường · 6 biểu đồ cố định
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AreaHeatmap locked={locked} />
      <PriceHistogram locked={locked} unit={unit} />
      <AssetTypeDonut locked={locked} />
      <LegalTypeDonut locked={locked} />
      <Top5Chart locked={locked} />
      <WeeklyHeatmap locked={locked} />
    </div>

    {hasBds && (
      <>
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 mt-2">
          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs flex-shrink-0">★</span>
          <span className="text-xs text-primary font-medium">
            <strong>Phân tích chuyên sâu bất động sản</strong> · 3 biểu đồ bên dưới chỉ áp dụng cho nhóm BĐS (25 phiên)
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BdsPriceBar locked={locked} />
          <BdsAreaHistogram locked={locked} unit={unit} />
          <BdsScatter locked={locked} />
        </div>
      </>
    )}
  </div>
);
