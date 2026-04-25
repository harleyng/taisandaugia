import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { bdsHighlights } from "@/lib/mockBdsReport";

const labels = ["❶", "❷", "❸", "❹", "❺"];

export const BdsHighlights = () => {
  return (
    <Card id="bds-highlights" className="p-6 md:p-7 border-l-4 border-l-accent scroll-mt-20">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="h-5 w-5 text-accent" />
        <h2 className="text-base md:text-lg font-semibold text-foreground">
          5 điểm nổi bật
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {bdsHighlights.map((text, idx) => (
          <div
            key={idx}
            className="rounded-lg bg-muted/50 p-4 border border-border/60 hover:border-accent/40 transition-colors"
          >
            <div className="text-2xl text-accent mb-2 font-bold leading-none">{labels[idx]}</div>
            <p className="text-sm text-foreground leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
