import type { ReactNode } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { customerErrorMessage, useUpsertCustomer } from "@/hooks/useCustomers";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/customers/customerStatus";
import type { CustomerStatus } from "@/types/customers";

/** Trạng thái đổi ngay trên trang chi tiết, không phải mở hộp thoại chỉnh sửa.
 *  Cùng khuôn với LeadStatusMenu. */
const OPTIONS = Object.keys(STATUS_LABELS) as CustomerStatus[];

interface Props {
  customerId: string;
  status: CustomerStatus;
  /** Trigger tuỳ biến — xem chú thích cùng prop ở LeadStatusMenu. */
  trigger?: ReactNode;
}

export function CustomerStatusMenu({ customerId, status, trigger }: Props) {
  const update = useUpsertCustomer();

  const pick = async (next: CustomerStatus) => {
    if (next === status) return;
    try {
      await update.mutateAsync({ id: customerId, status: next });
      toast.success(`Đã chuyển trạng thái sang "${STATUS_LABELS[next]}"`);
    } catch (err) {
      toast.error(customerErrorMessage(err) ?? "Không đổi được trạng thái");
    }
  };

  return (
    <DropdownMenu>
      {trigger ? (
        <DropdownMenuTrigger asChild disabled={update.isPending}>
          {trigger}
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          disabled={update.isPending}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Đổi trạng thái"
        >
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
              <ChevronDown className="h-3 w-3 opacity-70" />
            )}
          </span>
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
