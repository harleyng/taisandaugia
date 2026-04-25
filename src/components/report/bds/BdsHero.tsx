import { CalendarDays, Gavel, TrendingUp } from "lucide-react";
import { bdsMeta } from "@/lib/mockBdsReport";

export const BdsHero = () => (
  <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
    <div className="container py-8 md:py-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
        Báo cáo chuyên sâu
      </p>
      <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight">
        {bdsMeta.title}
      </h1>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Gavel className="h-4 w-4" />
          <span className="font-medium text-foreground">
            {bdsMeta.sessionCount.toLocaleString("vi-VN")} phiên
          </span>{" "}
          trong {bdsMeta.periodDays} ngày qua
        </span>
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4" />
          Tổng giá trị:{" "}
          <span className="font-medium text-foreground">
            {bdsMeta.totalValue.toLocaleString("vi-VN")} tỷ VND
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" />
          Cập nhật: <span className="font-medium text-foreground">30/09/2025</span>
        </span>
      </div>
    </div>
  </section>
);
