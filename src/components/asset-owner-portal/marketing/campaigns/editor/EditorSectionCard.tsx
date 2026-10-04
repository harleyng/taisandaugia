import { forwardRef, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorSectionCardProps {
  index: number;
  title: string;
  description?: string;
  done?: boolean;
  flash?: boolean;
  children: ReactNode;
}

/** Thẻ mục của trình soạn (bố cục như AdminCampaignEditor, kiểu thẻ của Trạm — §A8.6). */
export const EditorSectionCard = forwardRef<HTMLElement, EditorSectionCardProps>(
  ({ index, title, description, done, flash, children }, ref) => (
    <section
      ref={ref}
      className={cn(
        "scroll-mt-4 space-y-4 rounded-2xl bg-card p-4 shadow-card transition-shadow sm:p-5",
        flash && "ring-2 ring-primary/30",
      )}
    >
      <header className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            done ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
          )}
          aria-hidden="true"
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : index}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6 text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  ),
);
EditorSectionCard.displayName = "EditorSectionCard";
