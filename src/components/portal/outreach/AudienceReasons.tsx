import { interestSummary } from "@/lib/orgContacts/interestLabel";
import type { AuctionSessionItem } from "@/types/auction-session";
import type { AudienceDimension, AudienceReason, OrgContactInterest } from "@/types/org-contacts";

const DIM_LABEL: Record<AudienceDimension, string> = {
  category: "loại tài sản",
  province: "tỉnh/thành",
  price: "khoảng giá",
};

interface Props {
  reasons: AudienceReason[];
  lotsById: Map<string, AuctionSessionItem>;
  interestsById: Map<string, OrgContactInterest>;
}

/** Vì sao khách này được chọn — hiển thị nguyên văn kết quả của RPC, không suy diễn thêm. */
export function AudienceReasons({ reasons, lotsById, interestsById }: Props) {
  const byItem = new Map<string, AudienceReason[]>();
  for (const r of reasons) byItem.set(r.item_id, [...(byItem.get(r.item_id) ?? []), r]);

  return (
    <ul className="space-y-1 text-xs">
      {[...byItem].map(([itemId, rs]) => {
        const lot = lotsById.get(itemId);
        const how = rs.map((r) => {
          const interest = interestsById.get(r.interest_id);
          if (interest) return interestSummary(interest);
          return r.dims.length ? `khớp ${r.dims.map((d) => DIM_LABEL[d]).join(", ")}` : "nhu cầu không giới hạn";
        });
        return (
          <li key={itemId}>
            <span className="font-medium text-foreground">Lô {lot?.lot_no ?? rs[0].lot_no}</span>
            <span className="text-muted-foreground"> — theo nhu cầu: {how.join(" | ")}</span>
          </li>
        );
      })}
    </ul>
  );
}
