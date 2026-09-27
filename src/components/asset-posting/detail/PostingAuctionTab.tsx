import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { usePostingAuctionConsultations } from "@/hooks/useAuctionConsultations";
import { summarizeAuctionConsultations } from "@/lib/auctionConsult/status";
import { PostingAuctionConsultCard } from "@/components/auction-consult/PostingAuctionConsultCard";
import { RequestAuctionConsultDialog } from "@/components/auction-consult/RequestAuctionConsultDialog";
import type { AssetPosting } from "@/types/asset-posting";
import { usePostingCanWrite } from "../postingAccess";
import { CardAux, EmptyServiceCard } from "./detailParts";

/**
 * Tab "Tư vấn đấu giá": chưa có yêu cầu thì là thẻ trống + nút; đã có thì dùng lại
 * khối tư vấn đầy đủ (đề xuất, quyết định Áp dụng / Không dùng, phiên bản cũ).
 */
export function PostingAuctionTab({ posting: p, locked }: { posting: AssetPosting; locked: boolean }) {
  const [open, setOpen] = useState(false);
  const canWrite = usePostingCanWrite();
  const { data: rows = [], isLoading } = usePostingAuctionConsultations(p.id);
  const { active, current } = summarizeAuctionConsultations(rows);
  const prefill = {
    startingPrice: p.pricing_mode === "self" ? p.starting_price : null,
    auctionFormat: p.auction_format,
    expectedTimeline: p.expected_timeline,
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tư vấn đấu giá…
      </div>
    );
  }

  if (!active && !current) {
    return (
      <>
        <EmptyServiceCard
          title="Chưa có yêu cầu tư vấn đấu giá"
          description="Chuyên gia gợi ý giá khởi điểm, hình thức và thời điểm đấu giá phù hợp dựa trên các phiên tương tự."
          action={
            canWrite && !locked && <Button onClick={() => setOpen(true)}>Yêu cầu tư vấn</Button>
          }
        />
        {canWrite && (
          <RequestAuctionConsultDialog
            open={open}
            onOpenChange={setOpen}
            resolvePostingId={async () => p.id}
            prefill={prefill}
            isFollowUp={false}
          />
        )}
      </>
    );
  }

  return (
    <SectionCard
      title="Tư vấn đấu giá"
      actions={
        current && (
          <CardAux>
            Bản {current.version} · hoàn tất{" "}
            {current.completed_at ? format(new Date(current.completed_at), "dd/MM/yyyy", { locale: vi }) : "—"}
          </CardAux>
        )
      }
    >
      <PostingAuctionConsultCard postingId={p.id} mode="owner" locked={locked} prefill={prefill} showHistory />
    </SectionCard>
  );
}
