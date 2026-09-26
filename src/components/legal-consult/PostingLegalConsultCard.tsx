import { useMemo, useState } from "react";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePostingLegalConsultations } from "@/hooks/useLegalConsultations";
import { summarizeConsultations } from "@/lib/legalConsult/status";
import { ActiveLegalConsult } from "./ActiveLegalConsult";
import { LegalConsultHistory } from "./LegalConsultHistory";
import { LegalConsultResult } from "./LegalConsultResult";
import { RequestLegalConsultDialog } from "./RequestLegalConsultDialog";

interface PostingLegalConsultCardProps {
  /** null khi hồ sơ trong wizard chưa từng được lưu. */
  postingId: string | null;
  /** owner: gửi / thanh toán / rà soát lại · admin: xem tiến trình + kết quả. */
  mode: "owner" | "admin";
  /** Wizard truyền hàm tự lưu nháp; mặc định dùng postingId sẵn có. */
  resolvePostingId?: () => Promise<string | null>;
  /** Hồ sơ đã kết thúc (huỷ / đã ký hợp đồng) ⇒ không gửi yêu cầu mới. */
  locked?: boolean;
  /** Tệp hiện có của hồ sơ để chọn nhanh khi gửi. */
  postingDocPaths?: string[];
  /** Hiện lịch sử các phiên bản cũ (trang hồ sơ). */
  showHistory?: boolean;
}

/** Khối "Tư vấn pháp lý" của một hồ sơ số hoá — lần đang chạy, kết quả hiện hành, lịch sử. */
export function PostingLegalConsultCard({
  postingId,
  mode,
  resolvePostingId,
  locked,
  postingDocPaths = [],
  showHistory,
}: PostingLegalConsultCardProps) {
  const [open, setOpen] = useState(false);
  // Người xem / Cán bộ ngoài phạm vi chi nhánh chỉ xem.
  const canWrite = usePostingCanWrite();
  const { data: rows = [], isLoading } = usePostingLegalConsultations(postingId);
  const { active, current, versions } = summarizeConsultations(rows);
  const resolve = resolvePostingId ?? (async () => postingId);
  const loading = !!postingId && isLoading;

  // Tệp của lần tư vấn gần nhất cũng chọn lại được — đỡ tải lại khi rà soát lần sau.
  const available = useMemo(
    () => [...postingDocPaths, ...(rows[0]?.submitted_doc_paths ?? [])],
    [postingDocPaths, rows],
  );

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tư vấn pháp lý…
        </div>
      ) : current ? (
        <LegalConsultResult row={current} />
      ) : (
        !active && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-input bg-background p-4">
            <Scale className="h-8 w-8 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {mode === "owner"
                ? "Chưa tư vấn pháp lý. Gửi giấy tờ hiện có để chuyên gia chỉ ra mục nào đủ, mục nào còn thiếu trước khi đưa tài sản ra đấu giá."
                : "Hồ sơ chưa có tư vấn pháp lý."}
            </p>
          </div>
        )
      )}

      {active && <ActiveLegalConsult row={active} mode={mode} />}

      {mode === "owner" && canWrite && !loading && !active && !locked && (
        <Button type="button" variant={current ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
          <Scale className="mr-1.5 h-3.5 w-3.5" />
          {current ? "Bổ sung & rà soát lại" : "Yêu cầu tư vấn pháp lý"}
        </Button>
      )}

      {showHistory && <LegalConsultHistory versions={versions} />}

      {mode === "owner" && canWrite && (
        <RequestLegalConsultDialog
          open={open}
          onOpenChange={setOpen}
          resolvePostingId={resolve}
          availableDocPaths={available}
          isFollowUp={!!current}
        />
      )}
    </div>
  );
}
