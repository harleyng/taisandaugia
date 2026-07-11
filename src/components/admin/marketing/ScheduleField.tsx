import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  /** ISO string or "" */
  value: string;
  onChange: (iso: string) => void;
}

/** Date (Popover + Calendar) paired with a native time input → combined ISO string. */
export function ScheduleField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const dateObj = value ? new Date(value) : undefined;
  const timeStr = value ? format(new Date(value), "HH:mm") : "";

  const combine = (d: Date | undefined, t: string) => {
    if (!d) {
      onChange("");
      return;
    }
    const [h, m] = (t || "09:00").split(":").map(Number);
    const next = new Date(d);
    next.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
    onChange(next.toISOString());
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 gap-1.5 font-normal">
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateObj ? format(dateObj, "dd/MM/yyyy") : "Chọn ngày"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={(d) => {
              combine(d ?? undefined, timeStr);
              if (d) setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Input
        type="time"
        value={timeStr}
        onChange={(e) => combine(dateObj, e.target.value)}
        className="h-10 w-[130px]"
      />
    </div>
  );
}
