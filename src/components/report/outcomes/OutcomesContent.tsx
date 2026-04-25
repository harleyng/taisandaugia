import { OutcomesHero } from "./OutcomesHero";
import { OutcomesHighlights } from "./OutcomesHighlights";
import { OutcomesTOC } from "./OutcomesTOC";
import { OutcomesSectionMarketRate } from "./OutcomesSectionMarketRate";
import { OutcomesSectionByCategory } from "./OutcomesSectionByCategory";
import { OutcomesSectionByRegion } from "./OutcomesSectionByRegion";
import { OutcomesSectionByValue } from "./OutcomesSectionByValue";
import { OutcomesSectionReauction } from "./OutcomesSectionReauction";
import { OutcomesSectionHallOfFame } from "./OutcomesSectionHallOfFame";
import { OutcomesSectionTrend } from "./OutcomesSectionTrend";
import { OutcomesFinalCTA } from "./OutcomesFinalCTA";

export const OutcomesContent = () => (
  <>
    <OutcomesHero />
    <div className="container py-8 md:py-12">
      <div className="grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
        <OutcomesTOC />
        <div className="min-w-0 space-y-2">
          <OutcomesHighlights />
          <OutcomesSectionMarketRate />
          <OutcomesSectionByCategory />
          <OutcomesSectionByRegion />
          <OutcomesSectionByValue />
          <OutcomesSectionReauction />
          <OutcomesSectionHallOfFame />
          <OutcomesSectionTrend />
          <div className="pt-10 border-t border-border">
            <OutcomesFinalCTA />
          </div>
        </div>
      </div>
    </div>
  </>
);
