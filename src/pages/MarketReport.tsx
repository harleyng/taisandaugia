import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart2, Download, Loader2, Lock, Save } from "lucide-react";
import { ReportTopNav } from "@/components/report/ReportTopNav";
import { OppFilterBar } from "@/components/report/opp/OppFilterBar";
import { OppConfirmDialog } from "@/components/report/opp/OppConfirmDialog";
import { OppCharts } from "@/components/report/opp/OppCharts";
import { OppSessionTable } from "@/components/report/opp/OppSessionTable";
import { OppDrawer } from "@/components/report/opp/OppDrawer";
import { useCredits } from "@/hooks/useCredits";
import { LEGAL_TYPE_OPTIONS, type SessionRow } from "@/lib/mockOppReport";

const MATCH_COUNT = 47;

const MarketReport = () => {
  useEffect(() => {
    document.title = "Báo cáo Cơ hội Đấu giá — tàisảnđấugiá";
  }, []);

  // Filters
  const [regions, setRegions] = useState(["Hà Nội", "TP. Hồ Chí Minh"]);
  const [assetTypes, setAssetTypes] = useState(["bds", "xe", "mm", "hh", "dd", "khac"]);
  const [timePeriod, setTimePeriod] = useState("60");
  const [legalTypes, setLegalTypes] = useState(() => LEGAL_TYPE_OPTIONS.map((l) => l.id));
  const [priceRange, setPriceRange] = useState("all");
  const [areaMin, setAreaMin] = useState("80");
  const [areaMax, setAreaMax] = useState("500");

  const hasBds = assetTypes.includes("bds");

  // Report lifecycle
  const [isStale, setIsStale] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // UX
  const [unit, setUnit] = useState<"count" | "value">("count");
  const [drawerSession, setDrawerSession] = useState<SessionRow | null>(null);

  // Mini-bar
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [miniBarVisible, setMiniBarVisible] = useState(false);

  const { balance } = useCredits();

  // Mark stale when filters change after first generate
  const markStale = () => {
    if (hasGenerated) setIsStale(true);
  };

  const handleSetRegions = (v: string[]) => { setRegions(v); markStale(); };
  const handleSetAssetTypes = (v: string[]) => { setAssetTypes(v); markStale(); };
  const handleSetTimePeriod = (v: string) => { setTimePeriod(v); markStale(); };
  const handleSetLegalTypes = (v: string[]) => { setLegalTypes(v); markStale(); };
  const handleSetPriceRange = (v: string) => { setPriceRange(v); markStale(); };
  const handleSetAreaMin = (v: string) => { setAreaMin(v); markStale(); };
  const handleSetAreaMax = (v: string) => { setAreaMax(v); markStale(); };

  const handleGenerate = () => setConfirmOpen(true);

  const handleConfirm = () => {
    setConfirmOpen(false);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setUnlocked(true);
      setHasGenerated(true);
      setIsStale(false);
    }, 1700);
  };

  // Mini-bar via IntersectionObserver
  useEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setMiniBarVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const scrollToFilter = () => {
    filterBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Active filter summary for mini-bar
  const regionLabel = regions.length
    ? regions.slice(0, 2).join(", ") + (regions.length > 2 ? ` +${regions.length - 2}` : "")
    : "Chưa chọn";
  const timeLabel = {
    week: "Tuần này", next_week: "Tuần sau", "30": "30 ngày",
    "60": "60 ngày", "90": "90 ngày", month: "Tháng này",
  }[timePeriod] ?? "60 ngày";

  return (
    <div className="min-h-screen bg-background">
      <ReportTopNav />

      {/* ---- Mini bar (fixed, below ReportTopNav at top=64px) ---- */}
      <div
        className={`fixed left-0 right-0 z-[39] bg-card border-b border-border shadow-md px-4 py-2.5 flex items-center gap-3 transition-transform duration-300 ${miniBarVisible ? "translate-y-0" : "-translate-y-full"}`}
        style={{ top: "64px" }}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-serif text-xl font-semibold text-primary leading-none">{MATCH_COUNT}</span>
          <span className="text-[10px] text-muted-foreground leading-tight">phiên<br />khớp</span>
        </div>
        <div className="w-px h-6 bg-border flex-shrink-0" />
        <div className="flex gap-1.5 flex-1 overflow-x-auto scrollbar-none flex-nowrap">
          <span className="font-mono text-[10.5px] bg-muted border border-border rounded px-2 py-0.5 whitespace-nowrap flex-shrink-0">
            Khu vực: <strong>{regionLabel}</strong>
          </span>
          <span className="font-mono text-[10.5px] bg-muted border border-border rounded px-2 py-0.5 whitespace-nowrap flex-shrink-0">
            Thời gian: <strong>{timeLabel}</strong>
          </span>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="text-[11.5px] font-semibold text-muted-foreground bg-muted border border-border rounded-md px-2.5 py-1.5 hover:border-primary hover:text-primary transition-colors"
          >
            ↑ Lên đầu trang
          </button>
          <button className="text-[11.5px] font-semibold text-muted-foreground bg-muted border border-border rounded-md px-2.5 py-1.5 hover:border-primary hover:text-primary transition-colors flex items-center gap-1">
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      <main className="container py-8 md:py-10 max-w-5xl">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight mb-2">Báo cáo Cơ hội Đấu giá</h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            <strong className="text-foreground font-semibold">Hiểu thị trường trước khi đặt cọc.</strong>{" "}
            Báo cáo phân tích đúng phân khúc bạn quan tâm — giá đang ở đâu, nguồn cung sôi động hay nguội, cơ hội ở đâu chưa ai để ý.
          </p>
        </div>

        {/* Filter bar */}
        <OppFilterBar
          ref={filterBarRef}
          regions={regions} setRegions={handleSetRegions}
          assetTypes={assetTypes} setAssetTypes={handleSetAssetTypes}
          timePeriod={timePeriod} setTimePeriod={handleSetTimePeriod}
          legalTypes={legalTypes} setLegalTypes={handleSetLegalTypes}
          priceRange={priceRange} setPriceRange={handleSetPriceRange}
          areaMin={areaMin} setAreaMin={handleSetAreaMin}
          areaMax={areaMax} setAreaMax={handleSetAreaMax}
        />

        {/* Results */}
        <div className="relative">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 rounded-xl">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="font-serif text-base text-muted-foreground">Đang phân tích {MATCH_COUNT} phiên đấu giá…</p>
              <p className="text-xs text-muted-foreground mt-1">Tổng hợp phân bổ khu vực, phân khúc giá, đơn vị tham gia</p>
            </div>
          )}

          {/* Locked banner */}
          {!unlocked && !loading && (
            <div className="bg-[#1a2e1f] text-white rounded-xl px-6 py-5 mb-5 flex items-center justify-between gap-6 flex-wrap shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0">
                  <Lock className="h-4.5 w-4.5 text-white/80" />
                </div>
                <div>
                  <p className="font-semibold text-white text-[15px] leading-snug">Báo cáo phân tích đang khoá</p>
                  <p className="text-[12.5px] text-green-300/80 mt-0.5">
                    <span className="text-green-300 font-semibold">{MATCH_COUNT} cuộc</span> đấu giá khớp tiêu chí. Mở khoá để thấy số liệu, biểu đồ và danh sách với{" "}
                    <span className="text-green-300 font-semibold">⊛1 credit</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmOpen(true)}
                className="bg-yellow-300 hover:bg-yellow-200 text-yellow-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors flex-shrink-0 whitespace-nowrap"
              >
                Mở khoá báo cáo · ⊛1
              </button>
            </div>
          )}

          {/* Report banner (unlocked) */}
          {unlocked && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5 mb-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-600 mb-2">★ Insight chính</p>
                  <p className="font-serif text-base leading-relaxed">
                    <strong>{MATCH_COUNT} phiên</strong> khớp tiêu chí của bạn trong 60 ngày tới. Nguồn cung tập trung ở{" "}
                    <strong>Q.1 và Cầu Giấy</strong>, dồn vào <strong>tuần thứ 3</strong> (18 phiên), chủ yếu là tài sản <strong>thi hành án</strong> (38%).
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground bg-card border border-border rounded-lg px-3 py-2 hover:border-primary hover:text-primary transition-colors">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                  <button className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground bg-card border border-border rounded-lg px-3 py-2 hover:border-primary hover:text-primary transition-colors">
                    <Save className="h-3.5 w-3.5" /> Lưu
                  </button>
                </div>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-3 pt-3 border-t border-amber-200 flex items-center gap-2 flex-wrap">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                Báo cáo #OPR-2026-0517 · tạo 17/05/2026 · nguồn: Cổng Đấu giá tài sản quốc gia · xem lại miễn phí đến 18/05
              </p>
            </div>
          )}

          {/* Metrics row */}
          {(unlocked || !loading) && (
            <div className="flex gap-3 mb-5 flex-wrap">
              <div className="grid grid-cols-3 gap-3 flex-1">
                {[
                  {
                    label: unit === "count" ? "Tổng phiên khớp" : "Tổng giá khởi điểm",
                    value: unit === "count" ? "47" : "682",
                    unit: unit === "value" ? "tỷ" : undefined,
                    foot: <><span className="text-primary font-semibold">↑ 12%</span> so kỳ trước</>,
                    accent: "bg-primary",
                  },
                  {
                    label: unit === "count" ? "Tổng giá khởi điểm" : "Trung vị / phiên",
                    value: unit === "count" ? "682" : "4.2",
                    unit: "tỷ",
                    foot: "trung vị 4.2 tỷ / phiên",
                    accent: "bg-amber-500",
                  },
                  {
                    label: "Tuần cao điểm",
                    value: "Tuần 3",
                    foot: <><span className="text-destructive font-semibold">18 phiên</span> dồn 1 tuần</>,
                    accent: "bg-destructive",
                  },
                ].map((m, i) => (
                  <div
                    key={i}
                    className={`bg-card border border-border rounded-xl px-4 py-3.5 shadow-sm relative overflow-hidden ${!unlocked ? "blur-[3px] opacity-50 pointer-events-none select-none" : ""}`}
                  >
                    <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r ${m.accent}`} />
                    <p className="text-[10.5px] text-muted-foreground font-medium mb-2">{m.label}</p>
                    <p className="font-serif font-semibold text-2xl leading-none">
                      {m.value}
                      {m.unit && <small className="text-sm text-muted-foreground font-normal ml-1">{m.unit}</small>}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground mt-1.5">{m.foot}</p>
                    {!unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[4px] rounded-xl">
                        <Lock className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Unit toggle */}
              <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm min-w-[180px] flex flex-col justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Hiển thị theo</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Đổi giữa số phiên và giá trị · toàn bộ chart cập nhật</p>
                </div>
                <div className="flex border border-border rounded-lg overflow-hidden mt-3">
                  {(["count", "value"] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setUnit(u)}
                      className={`flex-1 text-xs py-2 font-semibold transition-colors border-r border-border last:border-r-0 ${unit === u ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                    >
                      {u === "count" ? "Số phiên" : "Giá trị"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Charts */}
          <OppCharts locked={!unlocked} hasBds={hasBds} unit={unit} />

          {/* Session table */}
          <OppSessionTable locked={!unlocked} onRowClick={setDrawerSession} />
        </div>

        {/* Always-visible CTA */}
        <div className="mt-6 relative overflow-hidden bg-gradient-to-br from-card to-amber-50/30 border border-amber-300 rounded-2xl px-8 py-7 shadow-md">
          <div className="flex items-center justify-between gap-8 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10.5px] uppercase tracking-widest text-amber-600 font-semibold mb-2 flex items-center gap-2">
                <span>⦿</span> Yêu cầu báo cáo riêng
              </p>
              <h4 className="font-serif text-xl font-semibold mb-2">Báo cáo này chưa đáp ứng nhu cầu của bạn?</h4>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                Đội ngũ phân tích có thể xây <strong className="text-foreground">báo cáo chuyên sâu theo yêu cầu</strong> — kết hợp dữ liệu đấu giá với nguồn riêng của bạn, hoặc tập trung vào góc nhìn chưa có sẵn. Phản hồi trong 24 giờ làm việc.
              </p>
            </div>
            <Link
              to="/lien-he"
              className="flex items-center gap-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow hover:-translate-y-0.5 transition-all flex-shrink-0"
            >
              <BarChart2 className="h-4 w-4" />
              Liên hệ tư vấn
              <span className="text-base">→</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Modals */}
      <OppConfirmDialog
        open={confirmOpen}
        matchCount={MATCH_COUNT}
        balance={balance}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
      <OppDrawer
        session={drawerSession}
        open={!!drawerSession}
        onClose={() => setDrawerSession(null)}
      />
    </div>
  );
};

export default MarketReport;
