import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const infoBoxVariants = cva("rounded-lg border p-3", {
  variants: {
    variant: {
      primary: "bg-primary/5 border-primary/20",
      amber: "bg-amber-50 border-amber-200 text-amber-800",
      muted: "bg-muted border-border",
      success: "bg-green-50 border-green-200 text-green-800",
    },
  },
  defaultVariants: { variant: "muted" },
});

interface InfoBoxProps extends VariantProps<typeof infoBoxVariants> {
  className?: string;
  children: React.ReactNode;
}

export function InfoBox({ variant, className, children }: InfoBoxProps) {
  return (
    <div className={cn(infoBoxVariants({ variant }), className)}>
      {children}
    </div>
  );
}
