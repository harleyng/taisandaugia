import { BellRing, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { DemandPaywallDialog } from "./DemandPaywallDialog";
import { useDemandSubscription } from "@/hooks/useDemandSubscription";

export const DemandStatusBadge = () => {
  const { status, daysRemaining } = useDemandSubscription();
  const [open, setOpen] = useState(false);

  if (status === "NOT_SUBSCRIBED") return null;

  if (status === "ACTIVE") {
    return (
      <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20 border-primary/20">
        <BellRing className="h-3 w-3" />
        Đang theo dõi · còn {daysRemaining} ngày
      </Badge>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex">
        <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted text-destructive border-destructive/40">
          <AlertCircle className="h-3 w-3" />
          Đã hết hạn — Gia hạn
        </Badge>
      </button>
      <DemandPaywallDialog open={open} onOpenChange={setOpen} title="Gia hạn theo dõi nhu cầu" />
    </>
  );
};
