import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatVnd } from "@/lib/advertising/slug";
import { QuoteDetails } from "./QuoteDetails";
import type { ContractTerms } from "@/types/consignment-contract";

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

interface ContractTermsCardProps {
  terms: ContractTerms;
  /** Giá khởi điểm của hồ sơ — để quy tiền đặt trước theo % ra VNĐ. */
  startingPrice?: number | null;
  className?: string;
}

/**
 * Điều khoản ĐÃ CHỐT (báo giá đóng băng lúc chủ tài sản chọn) — thứ dự thảo
 * hợp đồng phải bám theo. Không đọc báo giá sống vì tổ chức không sửa được nữa.
 */
export function ContractTermsCard({ terms, startingPrice, className }: ContractTermsCardProps) {
  const hasDetails = !!terms.plan || (terms.fee_items?.length ?? 0) > 0;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Figure label="Thù lao" value={terms.commission_pct != null ? `${terms.commission_pct}%` : "—"} />
        <Figure label="Phí dịch vụ" value={terms.service_fee != null ? formatVnd(terms.service_fee) : "—"} />
        <Figure
          label="Giá khởi điểm đề xuất"
          value={terms.starting_price != null ? formatVnd(terms.starting_price) : "—"}
        />
        <Figure
          label="Thời gian dự kiến"
          value={terms.lead_time_days != null ? `${terms.lead_time_days} ngày` : "—"}
        />
      </div>

      {hasDetails && (
        <Collapsible className="mt-3">
          <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
            Phương án & chi phí đã chốt
          </CollapsibleTrigger>
          <CollapsibleContent>
            <QuoteDetails
              plan={terms.plan}
              feeItems={terms.fee_items}
              startingPrice={startingPrice}
              className="mt-3 rounded-lg border border-border bg-muted/20 p-3"
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
