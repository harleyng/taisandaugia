import { useMemo, useState } from "react";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { AlertCircle, Box, Eye, EyeOff, Loader2, RotateCcw, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { summarizeScans, useAdminPublish3dModel, usePostingScans } from "@/hooks/useAsset3dScans";
import { Add3dDialog } from "./Add3dDialog";
import { Model3dViewer } from "./Model3dViewer";

interface PostingModel3dCardProps {
  /** null khi hồ sơ trong wizard chưa từng được lưu. */
  postingId: string | null;
  title: string;
  reviewStatus?: string | null;
  /** owner: được thêm/quét lại · admin: chỉ xem + duyệt model về muộn. */
  mode: "owner" | "admin";
  /** Wizard truyền hàm tự lưu nháp; mặc định dùng postingId sẵn có. */
  resolvePostingId?: () => Promise<string | null>;
  /** Hồ sơ đã kết thúc (huỷ / đã ký hợp đồng) ⇒ không thêm model mới. */
  locked?: boolean;
}

/** Khối "Model 3D" của một hồ sơ số hoá — trạng thái phiên quét, model hiện hành, công khai hay chưa. */
export function PostingModel3dCard({
  postingId,
  title,
  reviewStatus,
  mode,
  resolvePostingId,
  locked,
}: PostingModel3dCardProps) {
  const [open, setOpen] = useState(false);
  const [resume, setResume] = useState(false);
  const { data: scans = [], isLoading } = usePostingScans(postingId);
  const { inFlight, current, latest } = summarizeScans(scans);
  const canApprove = useHasAdminPermission("tai-san-tu-nguyen", "approve");
  const publish = useAdminPublish3dModel();
  // Người xem / Cán bộ ngoài phạm vi chi nhánh chỉ xem model, không quét.
  const canWrite = usePostingCanWrite();
  const owner = mode === "owner" && canWrite;

  // Giữ tham chiếu ổn định: dialog đồng bộ state theo prop này trong useEffect.
  const resumeScan = useMemo(
    () =>
      resume && inFlight
        ? { scanId: inFlight.id, scanToken: inFlight.scan_token, lotId: inFlight.asset_posting_id, reused: true, cost: 0 }
        : null,
    [resume, inFlight],
  );

  const resolve = resolvePostingId ?? (async () => postingId);
  const openAdd = (resumeInFlight: boolean) => {
    setResume(resumeInFlight);
    setOpen(true);
  };

  const lastFailed = !inFlight && latest && (latest.status === "failed" || latest.status === "expired") ? latest : null;
  const approved = reviewStatus === "approved";

  // KHÔNG return sớm khi đang tải: trong wizard, postingId đổi từ null → id ngay giữa
  // luồng xác nhận (lưu nháp ngầm) ⇒ query mới isLoading; return sớm sẽ unmount
  // dialog đang mở và mất bước quét.
  const loading = !!postingId && isLoading;

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải model 3D…
        </div>
      ) : current ? (
        <>
          <Model3dViewer
            modelUrl={current.model_url!}
            format={current.format}
            posterUrl={current.poster_url}
            title={title}
          />
          <VisibilityLine published={!!current.published_at} approved={approved} />
          {mode === "admin" && approved && !current.published_at && canApprove && (
            <Button
              size="sm"
              onClick={() => publish.mutate({ scanId: current.id, postingId: current.asset_posting_id })}
              disabled={publish.isPending}
            >
              {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Duyệt model 3D
            </Button>
          )}
        </>
      ) : (
        !inFlight && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-input bg-background p-4">
            <Box className="h-8 w-8 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {mode === "owner"
                ? "Chưa có model 3D. Quét 3D giúp người mua thấy rõ bề mặt, vết nứt và chi tiết của tài sản."
                : "Hồ sơ chưa có model 3D."}
            </p>
          </div>
        )
      )}

      {inFlight && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="flex-1 text-foreground">
            {inFlight.status === "processing"
              ? "Đối tác đang dựng model 3D — thường trong vòng 10 phút."
              : "Đang chờ kết quả quét từ điện thoại."}
          </span>
          {owner && (
            <Button size="sm" variant="outline" onClick={() => openAdd(true)}>
              <ScanLine className="mr-1.5 h-3.5 w-3.5" /> Mở lại liên kết quét
            </Button>
          )}
        </div>
      )}

      {lastFailed && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Lần quét gần nhất không thành công{lastFailed.error_message ? `: ${lastFailed.error_message}` : ""}.
          {lastFailed.refunded_at ? ` Đã hoàn ${lastFailed.credit_cost} credit.` : ""}
        </p>
      )}

      {owner && !loading && !inFlight && !locked && (
        <Button type="button" variant={current ? "outline" : "default"} size="sm" onClick={() => openAdd(false)}>
          {current ? <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> : <Box className="mr-1.5 h-3.5 w-3.5" />}
          {current ? "Quét lại 3D" : "Thêm 3D"}
        </Button>
      )}

      {owner && (
        <Add3dDialog
          open={open}
          onOpenChange={setOpen}
          resolvePostingId={resolve}
          resumeScan={resumeScan}
        />
      )}
    </div>
  );
}

function VisibilityLine({ published, approved }: { published: boolean; approved: boolean }) {
  if (published) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-success">
        <Eye className="h-3.5 w-3.5" /> Đang hiển thị công khai trên trang lô.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <EyeOff className="h-3.5 w-3.5" />
      {approved
        ? "Model mới — chờ sàn duyệt trước khi hiển thị công khai."
        : "Chưa công khai — model hiển thị sau khi hồ sơ được duyệt."}
    </p>
  );
}
