import { formatVnd } from "@/lib/advertising/slug";
import { formatWhen } from "@/lib/serviceRequests/form";
import { DetailRow, NoteBox } from "./DetailSection";

/** Khối "Báo giá & thanh toán" — cùng cột ở mọi bảng dịch vụ. */
export function QuotePaymentRows({
  row,
}: {
  row: {
    status: string;
    quoted_price: number | null;
    quote_expires_at: string | null;
    quote_note: string | null;
    paid_at: string | null;
    payment_txn_ref: string | null;
  };
}) {
  const expired = row.status === "quoted" && !!row.quote_expires_at && new Date(row.quote_expires_at).getTime() < Date.now();
  return (
    <>
      <DetailRow label="Giá báo" value={row.quoted_price != null ? formatVnd(row.quoted_price) : "—"} />
      <DetailRow
        label="Hiệu lực đến"
        value={
          row.quote_expires_at ? (
            <span className={expired ? "text-destructive" : undefined}>{formatWhen(row.quote_expires_at)}</span>
          ) : (
            "—"
          )
        }
      />
      {row.quote_note && <NoteBox>{row.quote_note}</NoteBox>}
      <DetailRow label="Thanh toán lúc" value={formatWhen(row.paid_at)} />
      <DetailRow label="Mã giao dịch" value={<span className="font-mono text-xs">{row.payment_txn_ref ?? "—"}</span>} />
    </>
  );
}

/** Dòng "Tài sản" — là link sang hồ sơ khi có quyền xem tài sản tự nguyện. */
export function PostingLink({
  title,
  postingId,
  canView,
  onOpen,
}: {
  title: string;
  postingId: string;
  canView: boolean;
  onOpen: (path: string) => void;
}) {
  if (!canView) return <>{title}</>;
  return (
    <button className="text-primary hover:underline" onClick={() => onOpen(`/admin/tai-san/${postingId}`)}>
      {title}
    </button>
  );
}
