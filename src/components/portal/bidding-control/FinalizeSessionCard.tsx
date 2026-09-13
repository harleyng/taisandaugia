import { Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { LOT_PHASE_LABELS } from "@/lib/bidding/lotPhase";
import type { FinalizeBlocker, FinalizePreview } from "@/lib/bidding/finalize";

/**
 * Lời mời chốt kết quả phiên — và lý do chưa chốt được.
 *
 * org_finalize_session chỉ trả `lots_not_closed` kèm một con số, nên màn hình tự
 * dựng danh sách lô chặn và TẮT nút trước khi bấm: để server từ chối rồi bắt đấu
 * giá viên đoán lô nào là bắt họ dò từng dòng giữa phiên.
 */

interface Props {
  preview: FinalizePreview;
  blockers: FinalizeBlocker[];
  onFinalize: () => void;
}

export function FinalizeSessionCard({ preview, blockers, onFinalize }: Props) {
  const blocked = blockers.length > 0;

  return (
    <Card className="rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Gavel className="h-4 w-4 text-primary" />
            Chốt kết quả phiên
          </h2>
          <p className="text-sm text-muted-foreground">
            Sẽ chốt: {preview.sold} lô đấu giá thành, {preview.unsold} lô không thành, {preview.withdrawn} lô đã rút ·{" "}
            {preview.applied} hồ sơ chuyển tiền đặt trước thành tiền mua tài sản, {preview.pendingRefund} hồ sơ chờ hoàn
            trả.
          </p>
        </div>
        <Button onClick={onFinalize} disabled={blocked} className="gap-1.5">
          Chốt kết quả phiên
        </Button>
      </div>

      {blocked && (
        <InfoBox variant="amber" className="mt-4 space-y-1.5 text-sm">
          <p className="font-medium">Còn {blockers.length} lô chưa đóng — chưa chốt kết quả được.</p>
          <ul className="space-y-1">
            {blockers.map((b) => (
              <li key={b.lotId}>
                Lô {b.lotNo} · {b.title} — {LOT_PHASE_LABELS[b.phase]}. {b.advice}
              </li>
            ))}
          </ul>
        </InfoBox>
      )}
    </Card>
  );
}
