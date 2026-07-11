import { forwardRef, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  index: number;
  title: string;
  description?: string;
  done?: boolean;
  flash?: boolean;
  children: ReactNode;
}

export const CampaignSectionCard = forwardRef<HTMLDivElement, Props>(
  ({ index, title, description, done, flash, children }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-card border rounded-2xl p-5 scroll-mt-4 transition-all",
        flash ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
    >
      <div className="flex items-start gap-2.5 mb-4">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            done ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary",
          )}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : index}
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground leading-6">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  ),
);
CampaignSectionCard.displayName = "CampaignSectionCard";
