import { CASE_TOPICS } from "@/lib/caseQa/topics";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}

/** Chọn chủ đề cho một điều khoản — engine chỉ tìm điều khoản theo chủ đề đã gắn. */
export function TopicPicker({ value, onChange, max = 6 }: Props) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((t) => t !== id) : [...value, id]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {CASE_TOPICS.map((t) => {
        const selected = value.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            disabled={!selected && value.length >= max}
            aria-pressed={selected}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
              selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
