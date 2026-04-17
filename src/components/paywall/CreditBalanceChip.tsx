import { Coins } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";

interface CreditBalanceChipProps {
  className?: string;
  variant?: "default" | "muted";
}

export const CreditBalanceChip = ({ className, variant = "default" }: CreditBalanceChipProps) => {
  const { balance } = useCredits();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        variant === "default"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-foreground",
        className
      )}
    >
      <Coins className="h-3.5 w-3.5" />
      {balance} credit
    </span>
  );
};
