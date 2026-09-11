import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, ExternalLink, Loader2, Megaphone, Send, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { SessionStateBadge } from "@/components/auction-sessions/SessionStateBadge";
import { CancelSessionDialog } from "@/components/portal/auction-sessions/CancelSessionDialog";
import { DeleteSessionDialog } from "@/components/portal/auction-sessions/DeleteSessionDialog";
import { PublishSessionDialog } from "@/components/portal/auction-sessions/PublishSessionDialog";
import { SessionFormCard } from "@/components/portal/auction-sessions/SessionFormCard";
import { SessionItemsCard } from "@/components/portal/auction-sessions/SessionItemsCard";
import { CaseDocumentsCard } from "@/components/portal/case-documents/CaseDocumentsCard";
import { SessionContractsCard } from "@/components/portal/bidding-contracts/SessionContractsCard";
import { useAuctionSession, useSessionOrg } from "@/hooks/useAuctionSessions";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";

type DialogKind = "publish" | "cancel" | "delete" | null;

/** /portal/phien-dau-gia/moi và /portal/phien-dau-gia/:id — tạo, sửa, thêm tài sản, công bố / huỷ. */
export default function PhienDauGiaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;
  const { auctionOrgId, isApproved, loading: orgLoading } = useSessionOrg();
  const { data: session, isLoading, error } = useAuctionSession(id);
  const canCreate = useHasOrgPermission("phien-dau-gia", "create");
  const canUpdate = useHasOrgPermission("phien-dau-gia", "update");
  const canDelete = useHasOrgPermission("phien-dau-gia", "delete");
  const canViewContracts = useHasOrgPermission("ho-so-tham-gia", "view");
  const canUpdateContracts = useHasOrgPermission("ho-so-tham-gia", "update");
  const [dialog, setDialog] = useState<DialogKind>(null);

  const backToList = () => navigate("/portal/phien-dau-gia");
  const closeDialog = (open: boolean) => !open && setDialog(null);

  const shell = (content: ReactNode) => (
    <div className="space-y-5 px-6 py-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={backToList}>
        <ArrowLeft className="h-4 w-4" />
        Danh sách phiên
      </Button>
      {content}
    </div>
  );

  if (orgLoading || (!isNew && isLoading)) {
    return shell(
      <Card className="flex items-center justify-center gap-2 rounded-2xl p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải phiên…
      </Card>,
    );
  }

  const blocked = !isNew
    ? error || !session
      ? "Không tìm thấy phiên, hoặc bạn không có quyền xem phiên này."
      : null
    : !isApproved || !auctionOrgId
      ? "Tổ chức cần được duyệt KYC và liên kết với danh bạ tổ chức đấu giá trước khi tạo phiên."
      : !canCreate
        ? "Vai trò của bạn chưa được cấp quyền tạo phiên đấu giá."
        : null;

  if (blocked) {
    return shell(
      <Card className="space-y-3 rounded-2xl p-10 text-center">
        <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{blocked}</p>
      </Card>,
    );
  }

  const status = session?.status ?? "draft";
  const editable = session ? status !== "cancelled" && canUpdate : canCreate;

  return shell(
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{session ? session.title : "Tạo phiên đấu giá"}</h1>
            {session && <SessionStateBadge session={session} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {session ? (
              <>
                Mã phiên <span className="font-mono">{session.code}</span>
              </>
            ) : (
              "Khai báo thông tin và lịch phiên, lưu nháp rồi thêm tài sản trước khi công bố."
            )}
          </p>
        </div>

        {session && (
          <div className="flex flex-wrap gap-2">
            {status !== "cancelled" && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/portal/phien-dau-gia/${session.id}/tiep-thi`)}>
                <Megaphone className="h-4 w-4" />
                Tiếp thị phiên
              </Button>
            )}
            {status !== "draft" && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/sessions/${session.id}`)}>
                <ExternalLink className="h-4 w-4" />
                Xem trên sàn
              </Button>
            )}
            {status === "draft" && canDelete && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDialog("delete")}>
                <Trash2 className="h-4 w-4" />
                Xoá nháp
              </Button>
            )}
            {status === "published" && canUpdate && (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setDialog("cancel")}>
                <Ban className="h-4 w-4" />
                Huỷ phiên
              </Button>
            )}
            {status === "draft" && canUpdate && (
              <Button size="sm" className="gap-1.5" onClick={() => setDialog("publish")}>
                <Send className="h-4 w-4" />
                Công bố
              </Button>
            )}
          </div>
        )}
      </div>

      {session?.status === "cancelled" && (
        <InfoBox variant="amber" className="text-sm">
          Phiên đã huỷ{session.cancelled_reason ? ` — lý do: ${session.cancelled_reason}` : ""}. Phiên vẫn hiện trên sàn kèm
          lý do và không chỉnh sửa được nữa.
        </InfoBox>
      )}

      <SessionFormCard
        key={session ? `${session.id}:${session.updated_at}` : "new"}
        session={session ?? null}
        readOnly={!editable}
        onCreated={(newId) => navigate(`/portal/phien-dau-gia/${newId}`, { replace: true })}
      />

      {session ? (
        <SessionItemsCard
          session={session}
          auctionOrgId={auctionOrgId}
          readOnly={status === "cancelled" || !canUpdate}
        />
      ) : (
        <Card className="rounded-2xl border-dashed p-6 text-center text-sm text-muted-foreground">
          Lưu nháp phiên để bắt đầu thêm tài sản.
        </Card>
      )}

      {/* Tài liệu phiên: nguồn duy nhất để AI trả lời người mua (kèm trích dẫn). */}
      {session && <CaseDocumentsCard session={session} readOnly={status === "cancelled" || !canUpdate} />}

      {/* Phiên nháp không bao giờ có hồ sơ: chỉ bán được khi đã công bố. */}
      {session && status !== "draft" && canViewContracts && (
        <SessionContractsCard session={session} canUpdate={canUpdateContracts} />
      )}

      {session && (
        <>
          <PublishSessionDialog
            session={session}
            isApproved={isApproved}
            open={dialog === "publish"}
            onOpenChange={closeDialog}
          />
          <CancelSessionDialog sessionId={session.id} open={dialog === "cancel"} onOpenChange={closeDialog} />
          <DeleteSessionDialog
            sessionId={session.id}
            title={session.title}
            open={dialog === "delete"}
            onOpenChange={closeDialog}
            onDeleted={backToList}
          />
        </>
      )}
    </>,
  );
}
