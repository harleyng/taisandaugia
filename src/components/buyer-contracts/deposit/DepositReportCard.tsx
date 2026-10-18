import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KvBox, Note } from "@/components/auction-sessions/detail/ui";
import { BTN } from "@/components/auction-sessions/detail/buttonStyles";
import { KycImageThumb } from "@/components/ekyc/KycImageThumb";
import { useAuth } from "@/contexts/AuthContext";
import { useReportDeposit, useUndoDepositReport, type MyContract } from "@/hooks/useBuyerContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { buyerDepositStateOf } from "@/lib/biddingContracts/buyerContract";
import { checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";
import { myContractPath } from "@/lib/biddingContracts/paths";
import { KYC_DOCUMENT_ACCEPT, discardKycUpload, uploadKycImage } from "@/lib/ekyc/uploadKycImage";
import { DocLine } from "../ui";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
    <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
    {children}
  </section>
);

/** Cột phải trang nộp đặt trước: báo đã nộp (+ chứng từ), chờ đối soát, đã nhận. */
export function DepositReportCard({ contract: c, due }: { contract: MyContract; due: number }) {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const report = useReportDeposit();
  const undo = useUndoDepositReport();
  const input = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const state = buyerDepositStateOf(c);
  const s = c.auction_sessions;

  const pick = async (file: File) => {
    if (!userId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const p = await uploadKycImage(userId, file, "document");
      if (proof) void discardKycUpload(proof);
      setProof(p);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Tải tệp lên không thành công.");
    } finally {
      setUploading(false);
    }
  };

  if (state === "pending") {
    const closed = !s || s.status !== "published" || !!s.finalized_at;
    return (
      <Card title="Đã nộp xong?">
        <p className="text-xs text-muted-foreground">
          Tải chứng từ chuyển khoản hoặc phiếu thu để tổ chức đối soát nhanh hơn.
        </p>
        <button
          type="button"
          disabled={uploading || closed}
          onClick={() => input.current?.click()}
          className="flex min-h-[72px] w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed border-border bg-card p-3.5 text-left transition-colors hover:border-primary hover:bg-primary/[.06] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {proof ? (
            <KycImageThumb path={proof} alt="Chứng từ nộp tiền" className="h-10 w-14 shrink-0" />
          ) : uploading ? (
            <Loader2 className="h-[22px] w-[22px] shrink-0 animate-spin text-primary" />
          ) : (
            <Upload className="h-[22px] w-[22px] shrink-0 text-primary" />
          )}
          <span>
            <b className="block text-sm font-semibold text-foreground">Chứng từ nộp tiền</b>
            <span className="text-xs text-muted-foreground">
              {proof ? "Đã tải lên · bấm để thay" : "Ảnh chụp màn hình hoặc PDF · không bắt buộc"}
            </span>
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept={KYC_DOCUMENT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void pick(f);
          }}
        />
        {uploadError && <p className="text-sm font-medium text-destructive">{uploadError}</p>}
        <Button
          className={BTN.primary}
          disabled={closed || uploading || report.isPending}
          onClick={() => report.mutate({ contractId: c.id, proofPath: proof })}
        >
          {report.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Tôi đã nộp tiền
        </Button>
      </Card>
    );
  }

  if (state === "sent") {
    return (
      <Card title="Chờ tổ chức đối soát">
        <Note tone="plain">
          Bạn báo đã nộp lúc {formatDateTime(c.deposit_reported_at)}. Tổ chức thường xác nhận trong giờ làm việc; trạng thái hồ
          sơ sẽ cập nhật khi xong.
        </Note>
        {c.deposit_proof_path && (
          <DocLine
            ext={/\.pdf$/i.test(c.deposit_proof_path) ? "PDF" : "ẢNH"}
            title="Chứng từ nộp tiền"
            sub="Đã gửi kèm lời báo"
          />
        )}
        <Button className={`${BTN.ghost} h-8 text-[13px]`} disabled={undo.isPending} onClick={() => undo.mutate(c.id)}>
          Báo nhầm, hoàn tác
        </Button>
      </Card>
    );
  }

  const opens = s ? formatDateTime(checkinWindowOf(s).opensAt.toISOString()) : "—";
  return (
    <Card title={state === "received" ? "Đã nhận tiền đặt trước" : "Tiền đặt trước"}>
      <KvBox
        rows={[
          { label: "Số tiền", value: <b>{formatVnd(c.deposit_amount_received ?? due)}</b> },
          { label: "Xác nhận lúc", value: formatDateTime(c.deposit_received_at) },
        ]}
      />
      {state === "received" && (
        <p className="text-xs text-muted-foreground">Bước tiếp theo: điểm danh từ {opens} để nhận số báo danh.</p>
      )}
      <Button className={BTN.primary} onClick={() => navigate(myContractPath(c.code))}>
        Xem hồ sơ của tôi
      </Button>
    </Card>
  );
}
