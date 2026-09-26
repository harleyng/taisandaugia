import { Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Nhãn "3D" cho lô / hồ sơ có model 3D (BR-3D-03). */
export function Model3dBadge({ className }: { className?: string }) {
  return (
    <Badge className={`gap-1 bg-primary/10 text-primary hover:bg-primary/10 ${className ?? ""}`} title="Có model 3D">
      <Box className="h-3 w-3" />
      3D
    </Badge>
  );
}
