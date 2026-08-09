import type { ReactNode } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUpsertLead } from "@/hooks/useLeads";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/leads/leadStatus";
import type { LeadStatus } from "@/types/leads";

/** Trạng thái đổi ngay trên trang chi tiết, không phải mở hộp thoại chỉnh sửa. */
const OPTIONS = (Object.keys(STATUS_LABELS) as LeadStatus[]).filter(
  // 'converted' do luồng "Chuyển thành khách hàng" đặt (nó còn tạo bản ghi
  // khách hàng và dời cơ hội) — chọn tay ở đây sẽ ra trạng thái rỗng ruột.
  (s) => s !== "converted",
);

interface Props {
  leadId: string;
  status: LeadStatus;
  /**
   * Trigger tuỳ biến. Mặc định là badge có mũi tên (badge vừa hiển thị vừa bấm
   * được). Truyền vào để tách hai vai: badge chỉ để ĐỌC, còn thao tác đổi trạng
   * thái nằm ở một nút riêng trong hàng thao tác.
   */
  trigger?: ReactNode;
}

export function LeadStatusMenu({ leadId, status, trigger }: Props) {
  const update = useUpsertLead();
  const converted = status === "converted";

  const pick = async (next: LeadStatus) => {
    if (next === status) return;
    try {
      await update.mutateAsync({ id: leadId, status: next });
      toast.success(`Đã chuyển trạng thái sang "${STATUS_LABELS[next]}"`);
    } catch {
      toast.error("Không đổi được trạng thái");
    }
  };

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        STATUS_BADGE_CLASS[status],
      )}
    >
      {STATUS_LABELS[status]}
      {update.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        !converted && <ChevronDown className="h-3 w-3 opacity-70" />
      )}
    </span>
  );

  // Đã chuyển đổi thì khoá — hạ cấp về 'new' sẽ để lại khách hàng mồ côi.
  // Chỉ áp cho trigger mặc định; với trigger tuỳ biến thì bên gọi tự vô hiệu hoá
  // nút (Radix truyền disabled xuống child qua asChild nên menu cũng không mở).
  if (converted && !trigger) {
    return <span title="Đã chuyển đổi thành khách hàng — không đổi trạng thái được">{badge}</span>;
  }

  return (
    <DropdownMenu>
      {trigger ? (
        <DropdownMenuTrigger asChild disabled={update.isPending || converted}>
          {trigger}
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          disabled={update.isPending}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Đổi trạng thái"
        >
          {badge}
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Đổi trạng thái</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((s) => (
          <DropdownMenuItem key={s} onClick={() => pick(s)}>
            <Check className={cn("h-4 w-4 mr-2", s === status ? "opacity-100" : "opacity-0")} />
            {STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
