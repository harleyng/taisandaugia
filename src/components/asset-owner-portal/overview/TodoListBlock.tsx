import { useNavigate } from "react-router-dom";
import { CheckCheck, ChevronRight, ClipboardCheck, Gavel, Hourglass, ListTodo, Megaphone, Wallet, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { IconTile } from "@/components/asset-owner-portal/ui/IconTile";
import type { TodoKind, TodoSummary } from "@/lib/ownerOverview";
import { formatMoneyShort } from "@/utils/money";
import { OWNER_MARKETING_HREF } from "@/lib/ownerMarketing/routes";

/** Mỗi dòng chỉ là lối vào trang nơi việc được làm — không thao tác ngay trên Tổng quan. */
const TODO_META: Record<TodoKind, { title: string; icon: LucideIcon; href: string; amountCaption: string }> = {
  outcome_due: { title: "Chờ khai kết quả", icon: Gavel, href: "/chu-tai-san/ket-qua", amountCaption: "giá khởi điểm" },
  awaiting_payment: {
    // Cùng số với huy hiệu "Thu tiền" ở menu (useOwnerPulse().awaitingPayment).
    title: "Chờ thu tiền",
    icon: Wallet,
    href: "/chu-tai-san/thu-tien",
    amountCaption: "còn phải thu",
  },
  pending_confirmation: {
    title: "Tài sản chờ xác nhận",
    icon: ClipboardCheck,
    href: "/chu-tai-san/tai-san",
    amountCaption: "giá khởi điểm",
  },
  stuck: { title: "Tài sản tồn đọng", icon: Hourglass, href: "/chu-tai-san/tai-san", amountCaption: "giá khởi điểm" },
  // Dòng này mang href riêng: trình soạn chiến dịch mở sẵn tài sản đứng đầu.
  push_marketing: { title: "Đẩy truyền thông", icon: Megaphone, href: OWNER_MARKETING_HREF, amountCaption: "giá khởi điểm" },
};

function TodoRow({ summary }: { summary: TodoSummary }) {
  const navigate = useNavigate();
  const meta = TODO_META[summary.kind];
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(summary.href ?? meta.href)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconTile icon={meta.icon} tone="muted" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
            <span className="truncate">{meta.title}</span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {summary.count.toLocaleString("en-US")}
            </span>
          </p>
          {/* Tài sản chờ lâu nhất của nhóm. */}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary.oldestTitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {summary.amount > 0 ? formatMoneyShort(summary.amount) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">{meta.amountCaption}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      </button>
    </li>
  );
}

/** Việc cần làm: một danh sách, mỗi loại việc một dòng; loại không còn việc thì ẩn. */
export function TodoListBlock({ todos, loading, className }: { todos: TodoSummary[]; loading: boolean; className?: string }) {
  const open = todos.filter((t) => t.count > 0);
  const total = open.reduce((n, t) => n + t.count, 0);

  return (
    <SectionCard title="Việc cần làm" icon={ListTodo} count={loading ? undefined : total} className={className}>
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] w-full rounded-xl" />
          ))}
        </div>
      ) : open.length === 0 ? (
        <EmptyState compact icon={CheckCheck} tone="success" title="Không có việc tồn — tốt lắm." />
      ) : (
        <ul className="-mx-2 divide-y">
          {open.map((t) => (
            <TodoRow key={t.kind} summary={t} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
