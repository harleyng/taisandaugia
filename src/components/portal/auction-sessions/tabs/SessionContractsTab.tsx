import { AlertTriangle, Download, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionContractsList } from "@/components/portal/bidding-contracts/SessionContractsList";
import { useSessionContractsWithRejected } from "@/hooks/useOrgBiddingContracts";
import { contractsCsv } from "@/lib/biddingContracts/contractDetail";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import { DetailNote, TabHeader } from "../DetailCard";
import { DESIGN_BTN } from "../SessionDetailHero";
import { SessionSaleContractsCard } from "../SessionSaleContractsCard";

interface Props {
  session: AuctionSessionWithItems;
  canView: boolean;
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-card">
      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-muted">
        <Users className="h-[18px] w-[18px]" />
      </span>
      <b className="mb-1 block text-[15px] text-foreground">{title}</b>
      {body}
    </section>
  );
}

function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Tab "Hồ sơ tham gia" (/portal/phien-dau-gia/:id/ho-so — design `contractsTab`).
 * Hồ sơ người mua đã trả tiền + đã bị từ chối; xem / duyệt / ghi nhận tiền đặt
 * trước ở trang chi tiết hồ sơ (/ho-so/:code). Sau khi chốt kết quả, hợp đồng mua
 * bán với người trúng đứng trên bảng (cùng mạch người tham gia → người trúng).
 */
export function SessionContractsTab({ session, canView }: Props) {
  const { data: rows = [], isLoading } = useSessionContractsWithRejected(
    session.status !== "draft" && canView ? session.id : null,
  );

  // Phiên nháp không bao giờ có hồ sơ: chỉ bán được khi đã công bố.
  if (session.status === "draft") {
    return <EmptyCard title="Chưa có hồ sơ tham gia" body="Phiên chưa công bố nên chưa bán được hồ sơ." />;
  }
  if (!canView) {
    return <EmptyCard title="Không có quyền xem" body="Vai trò của bạn chưa được cấp quyền xem hồ sơ tham gia." />;
  }

  return (
    <>
      <TabHeader
        title="Hồ sơ tham gia"
        description="Người mua đã thanh toán tiền hồ sơ qua sàn. Bấm một hồ sơ để xem giấy tờ, phê duyệt hoặc từ chối và ghi nhận tiền đặt trước."
        actions={
          <Button
            variant="outline"
            className={DESIGN_BTN}
            disabled={rows.length === 0}
            onClick={() => downloadCsv(`ho-so-tham-gia-${session.code ?? session.id}.csv`, contractsCsv(rows))}
          >
            <Download className="h-4 w-4" />
            Xuất danh sách
          </Button>
        }
      />

      {session.status === "cancelled" && (
        <DetailNote icon={<AlertTriangle />}>Phiên đã huỷ — chỉ ghi nhận hoàn trả tiền đặt trước cho người đã nộp.</DetailNote>
      )}

      {/* Thẻ tự ẩn khi phiên không có tài sản nào đấu giá thành. */}
      {session.finalized_at && <SessionSaleContractsCard session={session} contracts={rows} />}

      <SessionContractsList
        sessionId={session.id}
        sessionCancelled={session.status === "cancelled"}
        rows={rows}
        isLoading={isLoading}
        emptyText={
          session.dossier_fee
            ? "Chưa có người mua hồ sơ phiên này."
            : "Phiên chưa đặt giá bán hồ sơ nên người mua chưa mua được qua sàn."
        }
      />
    </>
  );
}
