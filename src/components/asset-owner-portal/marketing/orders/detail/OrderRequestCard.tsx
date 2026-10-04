import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import type { MarketingOrder } from "@/hooks/useOwnerMarketingOrders";
import { goalLabel } from "@/lib/ownerMarketing/orders";
import { PAYMENT_LABELS, paidAmountText } from "../payment";

function paymentText(o: MarketingOrder): string {
  if (!o.payment_method) return o.status === "cancelled" ? "Không thanh toán" : "Chưa thanh toán";
  const label = PAYMENT_LABELS[o.payment_method] ?? o.payment_method;
  const amount = o.payment_method === "subscription" ? null : paidAmountText(o);
  return amount ? `${label} · ${amount}` : label;
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border py-2.5 first:border-t-0 first:pt-0">
      <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

interface OrderRequestCardProps {
  order: MarketingOrder;
  branchName: string | null;
  /** Huỷ được: còn chờ báo giá / chờ thanh toán và có quyền truyen-thong:share. */
  cancellable: boolean;
  onCancel: () => void;
}

/** "Yêu cầu của bạn": mục tiêu, ghi chú cho sàn, chi nhánh, thanh toán + nút huỷ khi chưa trả. */
export function OrderRequestCard({ order: o, branchName, cancellable, onCancel }: OrderRequestCardProps) {
  return (
    <SectionCard title="Yêu cầu của bạn">
      <dl>
        <Item label="Mục tiêu">{goalLabel(o.goal)}</Item>
        <Item label="Ghi chú cho sàn">
          {o.brief ? (
            <blockquote className="mt-1 whitespace-pre-line rounded-lg bg-muted px-3 py-2.5 text-[13.5px] leading-relaxed">
              {o.brief}
            </blockquote>
          ) : (
            <span className="text-muted-foreground">Không có ghi chú</span>
          )}
        </Item>
        {branchName && <Item label="Chi nhánh">{branchName}</Item>}
        <Item label="Thanh toán">
          <span className="tabular-nums">{paymentText(o)}</span>
        </Item>
      </dl>
      {cancellable && (
        <Button
          variant="ghost"
          className="-mt-1 h-9 gap-1.5 self-start px-0 text-muted-foreground hover:bg-transparent hover:text-destructive"
          onClick={onCancel}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
          Huỷ yêu cầu
        </Button>
      )}
    </SectionCard>
  );
}
