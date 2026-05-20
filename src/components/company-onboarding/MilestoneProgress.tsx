import { Check, Minus } from "lucide-react";

type MilestoneStatus = "active" | "done" | "not-started";

interface MilestoneProgressProps {
  currentMilestone: 1 | "complete";
  mode?: "onboarding" | "profile";
}

export const MilestoneProgress = ({ currentMilestone, mode = "onboarding" }: MilestoneProgressProps) => {
  const isDone = currentMilestone === "complete";
  const status: MilestoneStatus = isDone ? "done" : mode === "profile" ? "not-started" : "active";

  return (
    <div className="w-full bg-white border border-border rounded-2xl shadow-sm px-6 py-5">
      <div className="flex items-center justify-center gap-3">
        <div
          className={[
            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all",
            status === "done" && "bg-green-500 text-white shadow-sm",
            status === "active" && "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20",
            status === "not-started" && "bg-muted/60 text-muted-foreground/60 border-2 border-dashed border-border",
          ].filter(Boolean).join(" ")}
        >
          {status === "done" && <Check className="h-5 w-5" />}
          {status === "not-started" && <Minus className="h-4 w-4" />}
          {status === "active" && <span>1</span>}
        </div>
        <div>
          <p className={[
            "text-sm font-semibold",
            status === "active" && "text-primary",
            status === "done" && "text-green-600",
            status === "not-started" && "text-muted-foreground/60",
          ].filter(Boolean).join(" ")}>
            KYC công ty
          </p>
          <p className={[
            "text-xs",
            status === "active" && "text-foreground",
            status === "done" && "text-green-600",
            status === "not-started" && "text-muted-foreground/50",
          ].filter(Boolean).join(" ")}>
            {status === "done" ? "Đã hoàn tất" : "Xác minh thông tin công ty"}
          </p>
        </div>
      </div>
    </div>
  );
};
