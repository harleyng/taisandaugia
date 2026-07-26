import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigatorLabel, shiftCursor, type TaskView } from "@/lib/tasks/taskBuckets";

export function TaskDateNavigator({
  view,
  cursor,
  onChange,
}: {
  view: TaskView;
  cursor: Date;
  onChange: (d: Date) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onChange(shiftCursor(view, cursor, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[160px] text-center text-sm font-medium text-foreground">
        {navigatorLabel(view, cursor)}
      </span>
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onChange(shiftCursor(view, cursor, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={() => onChange(new Date())}>
        Hôm nay
      </Button>
    </div>
  );
}
