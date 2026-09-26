import { Rotate3d } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Nhãn "VR" cho lô / hồ sơ đã gắn VR tour (BR-VR-04). */
export function VrTourBadge({ className }: { className?: string }) {
  return (
    <Badge className={`gap-1 bg-primary/10 text-primary hover:bg-primary/10 ${className ?? ""}`} title="Có VR tour">
      <Rotate3d className="h-3 w-3" />
      VR
    </Badge>
  );
}
