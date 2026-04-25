import { useEffect } from "react";
import { ReportTopNav } from "@/components/report/ReportTopNav";
import { ReportHero } from "@/components/report/ReportHero";
import { ReportTOC } from "@/components/report/ReportTOC";
import { ReportHighlights } from "@/components/report/ReportHighlights";
import { SectionOverview } from "@/components/report/SectionOverview";
import { SectionCompetition } from "@/components/report/SectionCompetition";
import { SectionOutcomes } from "@/components/report/SectionOutcomes";
import { SectionPriceTrend } from "@/components/report/SectionPriceTrend";
import { ReportSubscribeForm } from "@/components/report/ReportSubscribeForm";

const MarketReport = () => {
  useEffect(() => {
    document.title = "Báo cáo thị trường đấu giá tài sản Việt Nam";
    const meta = document.querySelector('meta[name="description"]');
    const desc =
      "Báo cáo định kỳ về thị trường đấu giá tài sản Việt Nam: tổng quan, cạnh tranh, kết quả và xu hướng giá.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <ReportTopNav />
      <main>
        <ReportHero />

        <div className="container py-8 md:py-12">
          <div className="grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
            <ReportTOC />

            <div className="min-w-0 space-y-2">
              <ReportHighlights />
              <SectionOverview />
              <SectionCompetition />
              <SectionOutcomes />
              <SectionPriceTrend />
              <ReportSubscribeForm />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MarketReport;
