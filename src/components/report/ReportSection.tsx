import { useState } from "react";
import { ArrowRight, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ReportSectionProps {
  id: string;
  label: string;
  title: string;
  keyInsight: string;
  deepDiveLabel: string;
  children: React.ReactNode;
  className?: string;
  hideDeepDive?: boolean;
}

export const ReportSection = ({
  id,
  label,
  title,
  keyInsight,
  deepDiveLabel,
  children,
  className,
  hideDeepDive,
}: ReportSectionProps) => {
  const [open, setOpen] = useState(false);

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

      {!hideDeepDive && (
        <Button variant="outline" className="group" onClick={() => setOpen(true)}>
          Đào sâu {deepDiveLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Sắp ra mắt</DialogTitle>
            <DialogDescription className="text-center">
              Báo cáo chuyên sâu cho phần "{deepDiveLabel}" đang được hoàn thiện và sẽ
              có mặt trong bản cập nhật sắp tới.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setOpen(false)}>Đã hiểu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
