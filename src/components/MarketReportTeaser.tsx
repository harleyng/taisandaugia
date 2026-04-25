import { ArrowRight, CalendarDays, Gavel, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { highlights, reportMeta } from "@/lib/mockMarketReport";

const numberLabels = ["❶", "❷", "❸"];

export const MarketReportTeaser = () => {
  return (
    <section className="container px-4 py-8 md:py-12">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-accent/5 border-l-4 border-l-accent p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                Báo cáo định kỳ
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-foreground leading-tight">
              {reportMeta.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-xs md:text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Cập nhật:{" "}
                <span className="font-medium text-foreground">
                  {reportMeta.updatedAt}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">
                  {reportMeta.sessionCount.toLocaleString("vi-VN")} phiên
                </span>{" "}
                trong {reportMeta.periodDays} ngày
              </span>
            </div>
          </div>

          <Button
            asChild
            size="lg"
            className="shrink-0 hidden md:inline-flex"
          >
            <Link to="/report">
              Xem báo cáo đầy đủ
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* 3 Highlight Cards */}
        <div className="grid gap-3 md:gap-4 md:grid-cols-3">
          {highlights.slice(0, 3).map((h, idx) => (
            <Link
              key={h.id}
              to="/report"
              className="group rounded-lg bg-card/70 backdrop-blur-sm p-4 border border-border/60 hover:border-accent/40 hover:bg-card transition-all"
            >
              <div className="text-2xl text-accent mb-2 font-bold leading-none group-hover:scale-110 transition-transform inline-block">
                {numberLabels[idx]}
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {h.text}
              </p>
            </Link>
          ))}
        </div>

        {/* Mobile CTA */}
        <Button asChild size="lg" className="w-full mt-5 md:hidden">
          <Link to="/report">
            Xem báo cáo đầy đủ
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
};
