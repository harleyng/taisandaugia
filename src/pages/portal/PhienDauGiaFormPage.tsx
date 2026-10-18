import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Loader2, ShieldAlert } from "lucide-react";
import { ConsignmentCanvas } from "@/components/portal/consignment/ConsignmentCanvas";
import { SessionForm } from "@/components/portal/auction-sessions/form/SessionForm";
import { useAuctionSession, useSessionOrg } from "@/hooks/useAuctionSessions";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { ROW_STATE_LABELS, sessionRowState } from "@/lib/auctionSessions/sessionList";

const LIST = "/portal/phien-dau-gia";

function Crumb({ code, id }: { code?: string; id?: string }) {
  const sep = <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  return (
    <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      <Link to={LIST} className="hover:text-foreground">
        Phiên đấu giá
      </Link>
      {sep}
      {id ? (
        <>
          <Link to={`${LIST}/${id}`} className="hover:text-foreground">
            {code}
          </Link>
          {sep}
          <span className="truncate font-semibold text-foreground">Chỉnh sửa</span>
        </>
      ) : (
        <span className="truncate font-semibold text-foreground">Tạo phiên</span>
      )}
    </nav>
  );
}

function StateBox({ children }: { children: ReactNode }) {
  return <div className="space-y-3 rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-card">{children}</div>;
}

/**
 * /portal/phien-dau-gia/moi và /portal/phien-dau-gia/:id/sua — một trang form riêng
 * (design "Phien Dau Gia - Cong Cong Ty"), thay cho chế độ sửa trong tab Thông tin.
 * Tài sản, tài liệu và công bố làm ở trang chi tiết sau khi lưu.
 */
export default function PhienDauGiaFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;
  const { auctionOrgId, isApproved, loading: orgLoading } = useSessionOrg();
  const { data: session, isLoading, error } = useAuctionSession(id);
  const canCreate = useHasOrgPermission("phien-dau-gia", "create");
  const canUpdate = useHasOrgPermission("phien-dau-gia", "update");

  const back = () => navigate(isNew ? LIST : `${LIST}/${id}`);

  let body: ReactNode;
  if (orgLoading || (!isNew && isLoading)) {
    body = (
      <StateBox>
        <p className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải phiên…
        </p>
      </StateBox>
    );
  } else {
    const blocked = isNew
      ? !isApproved || !auctionOrgId
        ? "Tổ chức cần được duyệt KYC và liên kết với danh bạ tổ chức đấu giá trước khi tạo phiên."
        : !canCreate
          ? "Vai trò của bạn chưa được cấp quyền tạo phiên đấu giá."
          : null
      : error || !session
        ? "Không tìm thấy phiên, hoặc bạn không có quyền xem phiên này."
        : session.status === "cancelled"
          ? "Phiên đã huỷ — không chỉnh sửa được nữa."
          : !canUpdate
            ? "Vai trò của bạn chưa được cấp quyền sửa phiên đấu giá."
            : null;

    body = blocked ? (
      <StateBox>
        <ShieldAlert className="mx-auto h-9 w-9" />
        <p>{blocked}</p>
      </StateBox>
    ) : (
      <>
        <header>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">
            {isNew ? "Tạo phiên đấu giá" : "Chỉnh sửa phiên"}
          </h1>
          <p className="mt-0.5 max-w-[640px] text-[13.5px] text-muted-foreground">
            {isNew
              ? "Khai báo thông tin và lịch phiên rồi lưu nháp. Tài sản, tài liệu và công bố làm ở bước sau."
              : "Thay đổi hiện ngay trên sàn nếu phiên đã công bố."}
          </p>
        </header>
        <SessionForm
          // Key theo id + updated_at: server trả bản mới thì form dựng lại.
          key={session ? `${session.id}:${session.updated_at}` : "new"}
          session={session ?? null}
          stateLabel={session ? ROW_STATE_LABELS[sessionRowState(session)] : "Nháp"}
          onSaved={(savedId) => navigate(`${LIST}/${savedId}`, { replace: true })}
          onCancel={back}
        />
      </>
    );
  }

  return (
    <ConsignmentCanvas>
      <div className="flex flex-col gap-5">
        <Crumb id={id} code={session?.code} />
        {body}
      </div>
    </ConsignmentCanvas>
  );
}
