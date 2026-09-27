import { AlertTriangle } from "lucide-react";
import { templateTypeDef, PLACEHOLDER_MARK } from "@/lib/contracts/templates/schema";
import { slotList, slotText } from "@/lib/contracts/templates/resolve";
import { cn } from "@/lib/utils";

interface ContractClausesViewProps {
  templateType: string;
  clauses: unknown;
  /** Slot không hiện (vd. ô giao kết điện tử đã in cạnh checkbox). */
  hideKeys?: readonly string[];
  /** Hiện cả khối thông tin Bên B (mẫu dịch vụ). */
  showParty?: boolean;
  className?: string;
}

/**
 * Câu chữ các slot của một mẫu, đúng thứ tự schema. Dùng chung: hộp thoại đồng ý
 * hợp đồng dịch vụ, trang hợp đồng, trang chi tiết mẫu (admin).
 */
export function ContractClausesView({
  templateType,
  clauses,
  hideKeys = [],
  showParty = false,
  className,
}: ContractClausesViewProps) {
  const def = templateTypeDef(templateType);
  if (!def) return null;
  const slots = def.slots.filter((s) => !hideKeys.includes(s.key) && (showParty || s.group !== "party"));

  return (
    <div className={cn("space-y-4 text-sm", className)}>
      {slots.map((slot) => {
        const list = slot.kind === "list" ? slotList(clauses, slot.key) : null;
        const text = slot.kind === "text" ? slotText(clauses, slot.key) : "";
        const missing = list ? list.length === 0 : !text;
        const placeholder = (list ? list.join(" ") : text).includes(PLACEHOLDER_MARK);
        return (
          <section key={slot.key} className="space-y-1">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {slot.label}
              {placeholder && <AlertTriangle className="h-3.5 w-3.5 text-warning" strokeWidth={1.5} aria-label="Còn thông tin cần nhập" />}
            </h4>
            {missing ? (
              <p className="italic text-muted-foreground">Chưa có nội dung.</p>
            ) : list ? (
              <ul className="list-disc space-y-1 pl-5 text-foreground">
                {list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="whitespace-pre-line text-foreground">{text}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
