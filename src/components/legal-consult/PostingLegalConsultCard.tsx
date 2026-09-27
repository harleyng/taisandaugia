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
import { ServiceBanner, ServiceBannerButton } from "@/components/asset-posting/ServiceBanner";

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
  /** "banner": banner gọn đầu bước 3 của wizard số hoá (thiết kế v3). */
  variant?: "card" | "banner";
}

/** Khối "Tư vấn pháp lý" của một hồ sơ số hoá — lần đang chạy, kết quả hiện hành, lịch sử. */
export function PostingLegalConsultCard({
  postingId,
  mode,
  resolvePostingId,
  locked,
  postingDocPaths = [],
  showHistory,
  variant = "card",
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

  const canRequest = mode === "owner" && canWrite && !loading && !active && !locked;
  const dialog = mode === "owner" && canWrite && (
    <RequestLegalConsultDialog
      open={open}
      onOpenChange={setOpen}
      resolvePostingId={resolve}
      availableDocPaths={available}
      isFollowUp={!!current}
    />
  );

  if (variant === "banner") {
    return (
      <>
        <ServiceBanner
          icon={<Scale />}
          title="Tư vấn pháp lý"
          desc="Chuyên gia rà soát giấy tờ và chỉ ra mục nào còn thiếu"
          status={active ? { text: "Đã gửi yêu cầu", tone: "warn" } : current ? { text: "Đã có kết quả tư vấn", tone: "ok" } : null}
          action={
            canRequest && (
              <ServiceBannerButton onClick={() => setOpen(true)} quiet={!!current}>
                {current ? "Bổ sung & rà soát lại" : "Yêu cầu tư vấn pháp lý"}
              </ServiceBannerButton>
            )
          }
        >
          {(active || current) && (
            <>
              {current && <LegalConsultResult row={current} />}
              {active && <ActiveLegalConsult row={active} mode={mode} />}
            </>
          )}
        </ServiceBanner>
        {dialog}
      </>
    );
  }

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

      {canRequest && (
        <Button type="button" variant={current ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
          <Scale className="mr-1.5 h-3.5 w-3.5" />
          {current ? "Bổ sung & rà soát lại" : "Yêu cầu tư vấn pháp lý"}
        </Button>
      )}

      {showHistory && <LegalConsultHistory versions={versions} />}

      {dialog}
    </div>
  );
}
