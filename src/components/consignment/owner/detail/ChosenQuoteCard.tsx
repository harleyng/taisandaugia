import { format } from "date-fns";
import { formatMoneyShort } from "@/utils/money";
import { depositLabel, estimatedCost, formatPct, orgSubLine } from "@/lib/consignment/ownerConsignmentView";
import { AUCTION_FORMAT_LABELS, type AssetPosting } from "@/types/asset-posting";
import type { RequestWithOrg } from "@/hooks/useAssetPosting";
import { ToneLabel } from "../KgStatusParts";
import { KgCard, KgOrg, KgSubLabel } from "./KgCard";
import { QuoteDocLink } from "./QuoteDocLink";

interface ChosenQuoteCardProps {
  posting: AssetPosting;
  selected: RequestWithOrg;
  record: string | null;
}

/** Tổ chức đã chọn + các con số của báo giá đã chấp nhận. */
export function ChosenQuoteCard({ posting, selected: q, record }: ChosenQuoteCardProps) {
  const cost = estimatedCost(q.quote_commission_pct, q.quote_service_fee, q.quote_starting_price ?? posting.starting_price);
  const money = (v: number | null) => (v != null ? formatMoneyShort(v) : "—");
  const specs: [string, string][] = [
    ["Tổng chi phí ước tính", money(cost)],
    ["Thù lao", q.quote_commission_pct != null ? formatPct(q.quote_commission_pct) : "—"],
    ["Phí dịch vụ", money(q.quote_service_fee)],
    ["Giá khởi điểm đề xuất", money(q.quote_starting_price)],
    ["Hình thức", q.quote_plan?.auction_format ? AUCTION_FORMAT_LABELS[q.quote_plan.auction_format] : "—"],
    ["Thời gian tổ chức", q.quote_lead_time_days != null ? `${q.quote_lead_time_days} ngày` : "—"],
    ["Tiền đặt trước", depositLabel(q.quote_plan) ?? "—"],
  ];

  return (
    <KgCard title="Tổ chức đã chọn" aux={`Chọn ngày ${format(new Date(q.updated_at), "dd/MM")}`}>
      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-success/30 bg-success/5 px-3.5 py-3">
        <KgOrg name={q.org?.name ?? "Tổ chức đấu giá"} logoUrl={q.org?.logo_url} sub={orgSubLine(q.org?.province, record)} />
        <ToneLabel tone="ok" className="shrink-0">
          Đã chọn
        </ToneLabel>
      </div>

      <KgSubLabel className="mt-[18px]">Báo giá đã chấp nhận</KgSubLabel>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-3">
        {specs.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[12.5px] text-muted-foreground">{k}</dt>
            <dd className="mt-px text-sm font-semibold text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      {q.quote_doc_path && (
        <div className="mt-3.5">
          <QuoteDocLink path={q.quote_doc_path} />
        </div>
      )}
    </KgCard>
  );
}
