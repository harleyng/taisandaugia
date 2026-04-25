import { ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReportSectionProps {
  id: string;
  label: string;
  title: string;
  keyInsight: string;
  deepDiveLabel: string;
  children: React.ReactNode;
  className?: string;
}

export const ReportSection = ({
  id,
  label,
  title,
  keyInsight,
  deepDiveLabel,
  children,
  className,
}: ReportSectionProps) => {
  return (
    <section id={id} className={cn("scroll-mt-20 pt-10 md:pt-14 border-t border-border", className)}>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
          Section {label}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
      </div>

      <div className="rounded-lg bg-primary/5 border-l-4 border-l-primary p-4 mb-6 flex gap-3">
        <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            Ý chính
          </p>
          <p className="text-sm md:text-base text-foreground leading-relaxed italic">
            "{keyInsight}"
          </p>
        </div>
      </div>

      <div className="mb-6">{children}</div>

      <Button variant="outline" className="group">
        Đào sâu {deepDiveLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Button>
    </section>
  );
};
