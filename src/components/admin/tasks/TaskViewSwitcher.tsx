import { List, CalendarDays, CalendarRange, Calendar } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TaskView } from "@/lib/tasks/taskBuckets";

const OPTIONS: { value: TaskView; label: string; icon: typeof List }[] = [
  { value: "list", label: "Danh sách", icon: List },
  { value: "agenda", label: "Lịch trình", icon: CalendarDays },
  { value: "week", label: "Tuần", icon: CalendarRange },
  { value: "month", label: "Tháng", icon: Calendar },
];

export function TaskViewSwitcher({
  view,
  onChange,
}: {
  view: TaskView;
  onChange: (v: TaskView) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(v) => v && onChange(v as TaskView)}
      variant="outline"
      size="sm"
      className="justify-start"
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        return (
          <ToggleGroupItem key={o.value} value={o.value} className="gap-1.5">
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{o.label}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
