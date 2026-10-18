import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KycImageThumb } from "@/components/ekyc/KycImageThumb";
import { useAuth } from "@/contexts/AuthContext";
import { useSubmitAbsenceAppeal } from "@/hooks/useBuyerContracts";
import { KYC_DOCUMENT_ACCEPT, discardKycUpload, uploadKycImage } from "@/lib/ekyc/uploadKycImage";
import type { BiddingContract } from "@/types/bidding-contract";
import { CheckinModal } from "./CheckinModal";

const MIN_NOTE = 10;
const MAX_NOTE = 2000;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Pick<BiddingContract, "id" | "code" | "absence_appeal_note" | "absence_appeal_path">;
}

/**
 * Người mua bị ghi vắng gửi lý do bất khả kháng + giấy tờ chứng minh. Tổ chức xem
 * ở tab Điểm danh và quyết miễn trừ (hoàn tiền đặt trước) — sàn không tự hoàn.
 * Gửi lại được (ghi đè) cho tới khi tổ chức đã chấp nhận.
 */
export function AbsenceAppealDialog({ open, onOpenChange, contract: c }: Props) {
  const { userId } = useAuth();
  const submit = useSubmitAbsenceAppeal();
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote(c.absence_appeal_note ?? "");
    setProof(null);
    setUploadError(null);
  }, [open, c.absence_appeal_note]);

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

  const shownProof = proof ?? c.absence_appeal_path;
  const trimmed = note.trim();
  const tooShort = trimmed.length < MIN_NOTE;

  return (
    <CheckinModal
      open={open}
      onOpenChange={onOpenChange}
      title="Gửi lý do vắng mặt"
      sub={<span>Hồ sơ <span className="font-mono">{c.code}</span> · tổ chức đấu giá xem xét hoàn trả</span>}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="absence-note">
          Lý do vắng mặt <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="absence-note"
          rows={4}
          maxLength={MAX_NOTE}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: nhập viện cấp cứu sáng ngày đấu giá (kèm giấy ra viện)."
        />
        <span className="text-xs text-muted-foreground">Tối thiểu {MIN_NOTE} ký tự.</span>
      </div>

      <button
        type="button"
        disabled={uploading}
        onClick={() => input.current?.click()}
        className="flex min-h-[72px] w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed border-border bg-card p-3.5 text-left transition-colors hover:border-primary hover:bg-primary/[.06] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {shownProof ? (
          <KycImageThumb path={shownProof} alt="Giấy tờ chứng minh" className="h-10 w-14 shrink-0" />
        ) : uploading ? (
          <Loader2 className="h-[22px] w-[22px] shrink-0 animate-spin text-primary" />
        ) : (
          <Upload className="h-[22px] w-[22px] shrink-0 text-primary" />
        )}
        <span>
          <b className="block text-sm font-semibold text-foreground">Giấy tờ chứng minh</b>
          <span className="text-xs text-muted-foreground">
            {shownProof ? "Đã tải lên · bấm để thay" : "Giấy ra viện, giấy xác nhận… · ảnh hoặc PDF · không bắt buộc"}
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
        className="h-11 w-full text-[15px] font-semibold"
        disabled={tooShort || uploading || submit.isPending}
        onClick={() =>
          submit.mutate({ contractId: c.id, note: trimmed, proofPath: proof }, { onSuccess: () => onOpenChange(false) })
        }
      >
        {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {c.absence_appeal_note ? "Gửi lại lý do" : "Gửi lý do"}
      </Button>
    </CheckinModal>
  );
}
