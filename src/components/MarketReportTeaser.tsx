import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const highlights = [
  {
    n: "1",
    heading: "Phiên bạn quan tâm có giá hợp lý không?",
    body: "So sánh giá khởi điểm/m² với mặt bằng từng quận — phát hiện ngay phiên bất thường.",
  },
  {
    n: "2",
    heading: "Phân khúc này đang sôi động hay nguội?",
    body: "Nắm bắt số phiên sắp tổ chức so với kỳ trước · Nhận diện khi có thay đổi nguồn cung.",
  },
  {
    n: "3",
    heading: "Cơ hội ở đâu mà bạn chưa biết?",
    body: "Top chủ tài sản đang đăng nhiều tài sản ra · phát hiện cụm thị trường sôi động.",
  },
];

export const MarketReportTeaser = () => (
  <section className="container px-4 py-8 md:py-12">
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-accent/5 border-l-4 border-l-accent p-6 md:p-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-7">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-accent font-mono">
              Báo cáo cơ hội
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-semibold text-foreground leading-snug max-w-xl">
            Hiểu thị trường đấu giá ở phân khúc bạn quan tâm
            <span className="text-muted-foreground font-normal"> — trước khi đặt cọc</span>
          </h2>

        </div>

        <Link
          to="/report"
          className="hidden md:inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-3 rounded-xl shadow hover:opacity-90 hover:-translate-y-0.5 transition-all flex-shrink-0"
        >
          Xem báo cáo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="w-full h-px bg-border mb-7" />

      {/* ── 3 highlight cards ── */}
      <div className="grid gap-3 md:gap-4 md:grid-cols-3">
        {highlights.map((h) => (
          <Link
            key={h.n}
            to="/report"
            className="group rounded-xl bg-card/70 backdrop-blur-sm p-5 border border-border/60 hover:border-accent/40 hover:bg-card transition-all"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-mono text-[11px] font-bold text-primary leading-none flex-shrink-0">
                {h.n}
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground leading-snug mb-1.5">
              {h.heading}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {h.body}
            </p>
          </Link>
        ))}
      </div>

      {/* ── Mobile CTA ── */}
      <Link
        to="/report"
        className="mt-5 md:hidden flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-3 rounded-xl w-full"
      >
        Xem báo cáo
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  </section>
);
