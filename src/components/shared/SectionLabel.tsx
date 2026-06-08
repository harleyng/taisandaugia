import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <p className={cn("text-xs text-muted-foreground uppercase tracking-wider", className)}>
      {children}
    </p>
  );
}
