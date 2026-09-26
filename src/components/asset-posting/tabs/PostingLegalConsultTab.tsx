import { Card, CardContent } from "@/components/ui/card";
import { PostingLegalConsultCard } from "@/components/legal-consult/PostingLegalConsultCard";
import type { AssetPosting } from "@/types/asset-posting";

/** Tab "Tư vấn pháp lý": lần đang chạy, kết quả hiện hành và các phiên bản cũ. */
export function PostingLegalConsultTab({ posting: p }: { posting: AssetPosting }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Tư vấn pháp lý</h2>
          <p className="text-sm text-muted-foreground">
            Chuyên gia rà soát giấy tờ, đánh dấu từng mục Đủ / Thiếu / Cần làm rõ. Mỗi lần tư vấn được lưu thành một phiên
            bản kèm thời gian hoàn tất.
          </p>
        </div>
        <PostingLegalConsultCard
          postingId={p.id}
          mode="owner"
          locked={p.status === "cancelled" || p.status === "contracted"}
          postingDocPaths={[...(p.ownership_proof_urls ?? []), ...(p.doc_urls ?? [])]}
          showHistory
        />
      </CardContent>
    </Card>
  );
}
