import { Gavel } from "lucide-react";
import { hasOnlineRoom } from "@/lib/auctionSessions/buyerJourney";
import { BIDDING_METHOD_DESCRIPTIONS, biddingMethodOf, methodRuleRows } from "@/lib/bidding/methods";
import type { PublicSessionDetail } from "@/types/auction-session";
import { SectionCard } from "./ui";

/** "Quy tắc trả giá" — chỉ phiên trực tuyến (phòng đấu giá trên sàn áp các quy tắc này). */
export function SessionRulesCard({ session }: { session: PublicSessionDetail }) {
  if (!hasOnlineRoom(session.auction_format)) return null;
  const rules = methodRuleRows(session);
  return (
    <SectionCard icon={Gavel} title="Quy tắc trả giá">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 pb-5 sm:grid-cols-3">
        {rules.map((r) => (
          <div key={r.label} className="min-w-0">
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <b className="block text-base text-foreground">{r.value}</b>
          </div>
        ))}
        <p className="col-span-full text-sm leading-relaxed text-muted-foreground">
          {BIDDING_METHOD_DESCRIPTIONS[biddingMethodOf(session.bidding_method)]}
        </p>
      </div>
    </SectionCard>
  );
}
