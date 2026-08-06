import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  /** Nội dung giải thích. Xuống dòng bằng nhiều <p>, đừng nhồi một khối dài. */
  children: React.ReactNode;
  label?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Dấu "?" mở tooltip giải thích.
 *
 * Dùng thay cho việc đổ nguyên đoạn văn hướng dẫn ra màn hình: chữ giải thích
 * luôn chiếm chỗ nhưng chỉ hữu ích ở lần đầu, đọc vài lần là thành nhiễu và
 * người dùng bắt đầu bỏ qua cả những dòng thật sự quan trọng.
 *
 * TooltipProvider đã bọc toàn app ở App.tsx nên không cần bọc lại.
 */
export function HelpHint({ children, label = "Giải thích", side = "top" }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors align-middle"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs space-y-1.5 text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
