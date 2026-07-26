import { ScanLine, Scale, Landmark, Gavel, Wrench, type LucideIcon } from "lucide-react";

// Ánh xạ tên icon (auction_tools.icon) → component lucide. Fallback Wrench.
const MAP: Record<string, LucideIcon> = {
  ScanLine,
  Scale,
  Landmark,
  Gavel,
  Wrench,
};

export function toolIcon(name: string | null | undefined): LucideIcon {
  return (name && MAP[name]) || Wrench;
}
