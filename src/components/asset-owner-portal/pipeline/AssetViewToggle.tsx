import { KanbanSquare, Table2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { OwnerAssetsView } from "./assetsView";

const OPTIONS: { value: OwnerAssetsView; label: string; icon: typeof Table2 }[] = [
  { value: "table", label: "Bảng", icon: Table2 },
  { value: "kanban", label: "Giai đoạn", icon: KanbanSquare },
];

/** Bảng / Giai đoạn. Nhãn luôn hiện (không nút chỉ có icon — §A8.5). */
export function AssetViewToggle({
  view,
  onChange,
}: {
  view: OwnerAssetsView;
  onChange: (v: OwnerAssetsView) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(v) => v && onChange(v as OwnerAssetsView)}
      variant="outline"
      size="sm"
      aria-label="Chế độ xem"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value} className="gap-1.5">
          <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
