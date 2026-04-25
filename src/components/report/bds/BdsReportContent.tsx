import { BdsHero } from "./BdsHero";
import { BdsHighlights } from "./BdsHighlights";
import { BdsTOC } from "./BdsTOC";
import { BdsSectionPriceMap } from "./BdsSectionPriceMap";
import { BdsSectionDelta } from "./BdsSectionDelta";
import { BdsSectionDistribution } from "./BdsSectionDistribution";
import { BdsSectionHallOfFame } from "./BdsSectionHallOfFame";
import { BdsSectionPriceTrend } from "./BdsSectionPriceTrend";
import { BdsSectionOutcomes } from "./BdsSectionOutcomes";
import { BdsFinalCTA } from "./BdsFinalCTA";

export const BdsReportContent = () => {
  return (
    <>
      <BdsHero />
      <div className="container py-8 md:py-12">
        <div className="grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
          <BdsTOC />
          <div className="min-w-0 space-y-2">
            <BdsHighlights />
            <BdsSectionPriceMap />
            <BdsSectionDelta />
            <BdsSectionDistribution />
            <BdsSectionHallOfFame />
            <BdsSectionPriceTrend />
            <BdsSectionOutcomes />
            <div className="pt-10 border-t border-border">
              <BdsFinalCTA />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
