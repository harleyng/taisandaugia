import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InfoCardShellProps {
  title: string;
  headerVariant?: "muted" | "primary";
  icon?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}

export function InfoCardShell({
  title,
  headerVariant = "muted",
  icon,
  bodyClassName,
  className,
  children,
}: InfoCardShellProps) {
  const headerClass = headerVariant === "primary"
    ? "bg-primary px-5 py-3 flex items-center gap-2"
    : "bg-muted px-5 py-3 flex items-center gap-2";

  const titleClass = headerVariant === "primary"
    ? "text-base font-semibold text-primary-foreground"
    : "text-lg font-bold text-foreground";

  return (
    <Card className={cn("p-0 overflow-hidden", className)}>
      <div className={headerClass}>
        {icon}
        <h2 className={titleClass}>{title}</h2>
      </div>
      <div className={cn("p-5", bodyClassName)}>
        {children}
      </div>
    </Card>
  );
}
