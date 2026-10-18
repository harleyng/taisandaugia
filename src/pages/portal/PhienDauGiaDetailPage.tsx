import type { ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, Loader2, ShieldAlert } from "lucide-react";
import { ConsignmentCanvas } from "@/components/portal/consignment/ConsignmentCanvas";
import { SessionDetailHero } from "@/components/portal/auction-sessions/SessionDetailHero";
import {
  SessionDetailTabs,
  type SessionTab,
  type TabCount,
} from "@/components/portal/auction-sessions/SessionDetailTabs";
import { SessionCheckinTab } from "@/components/portal/auction-sessions/tabs/SessionCheckinTab";
import { SessionContractsTab } from "@/components/portal/auction-sessions/tabs/SessionContractsTab";
import { SessionControlTab } from "@/components/portal/auction-sessions/tabs/SessionControlTab";
import { SessionDocumentsTab } from "@/components/portal/auction-sessions/tabs/SessionDocumentsTab";
import { SessionInfoTab } from "@/components/portal/auction-sessions/tabs/SessionInfoTab";
import { SessionItemsTab } from "@/components/portal/auction-sessions/tabs/SessionItemsTab";
import { SessionOutreachTab } from "@/components/portal/auction-sessions/tabs/SessionOutreachTab";
import { useAuctionSession, useSessionOrg } from "@/hooks/useAuctionSessions";
import { useCaseDocuments } from "@/hooks/useCaseDocuments";
import { useSessionBiddingContracts } from "@/hooks/useOrgBiddingContracts";
import { useHasOrgPermission, useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { UPLOADABLE_DOC_TYPES } from "@/lib/caseQa/labels";
import { sessionRowState } from "@/lib/auctionSessions/sessionList";

export type { SessionTab };

const LIST = "/portal/phien-dau-gia";
const ONLINE_FORMATS = new Set(["truc_tuyen", "ca_hai"]);

function Crumb({ current }: { current?: string }) {
  return (
    <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      <Link to={LIST} className="shrink-0 hover:text-foreground">
        Phiên đấu giá
      </Link>
      {current && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate font-semibold text-foreground">{current}</span>
        </>
      )}
    </nav>
  );
}

function StateBox({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-card">{children}</div>
  );
}

/**
 * /portal/phien-dau-gia/:id — thẻ đầu trang + hàng tab nhóm (design "Phien Dau Gia -
 * Cong Cong Ty", pdg-detail.js). Tạo / sửa phiên là trang form riêng
 * (PhienDauGiaFormPage: /moi, /:id/sua).
 *
 * Tab chạy trên ĐƯỜNG DẪN chứ không phải state hay ?tab=: các route cũ
 * (`:id`, `:id/tiep-thi`, `:id/dieu-hanh`) vẫn còn nguyên, và quan trọng hơn,
 * `/dieu-hanh` được gác ở cấp route bằng module RIÊNG `dieu-hanh-dau-gia`
 * (App.tsx) — gộp thành một route là mất lớp gác đó.
 */
export default function PhienDauGiaDetailPage({ tab = "thong-tin" }: { tab?: SessionTab }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { auctionOrgId, isApproved, loading: orgLoading } = useSessionOrg();
  const { data: session, isLoading, error } = useAuctionSession(id);
  const canUpdate = useHasOrgPermission("phien-dau-gia", "update");
  const canDelete = useHasOrgPermission("phien-dau-gia", "delete");
  const canViewContracts = useHasOrgPermission("ho-so-tham-gia", "view");
  // Theo tổ chức của PHIÊN — xem chú thích ở useHasOrgPermissionIn.
  const canRunAuction = useHasOrgPermissionIn(session?.organization_id, "dieu-hanh-dau-gia", "view");
  const canCheckIn = useHasOrgPermissionIn(session?.organization_id, "ho-so-tham-gia", "checkin");
  // Số trên tab: tài liệu đã xác nhận, hồ sơ chờ duyệt (chỉ khi đang nhận hồ sơ).
  const state = session ? sessionRowState(session) : null;
  const { data: docs = [] } = useCaseDocuments(session && session.status !== "cancelled" ? session.id : null);
  const { data: contracts = [] } = useSessionBiddingContracts(
    session && state === "reg" && canViewContracts ? session.id : null,
  );
  // Link cũ "?sua=1" (chế độ sửa trong tab Thông tin) ⇒ chuyển sang trang form.
  const [searchParams] = useSearchParams();
  const legacyEdit = searchParams.get("sua") === "1";

  if (legacyEdit && id) return <Navigate to={`${LIST}/${id}/sua`} replace />;

  if (orgLoading || isLoading) {
    return (
      <ConsignmentCanvas>
        <Crumb />
        <StateBox>
          <p className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải phiên…
          </p>
        </StateBox>
      </ConsignmentCanvas>
    );
  }

  if (error || !session) {
    return (
      <ConsignmentCanvas>
        <Crumb />
        <StateBox>
          <ShieldAlert className="mx-auto h-9 w-9" />
          <p>Không tìm thấy phiên, hoặc bạn không có quyền xem phiên này.</p>
        </StateBox>
      </ConsignmentCanvas>
    );
  }

  const tabPath = (value: SessionTab) => `${LIST}/${session.id}${value === "thong-tin" ? "" : `/${value}`}`;

  // Tab vận hành chỉ hiện khi có gì để xem — nhưng VẪN hiện nếu người dùng đang
  // đứng sẵn ở route đó, để họ không mất lối ra khỏi tab đang mở.
  // Hồ sơ: chỉ phiên đã công bố mới bán được hồ sơ.
  // Điểm danh: mọi phiên đã công bố như design (phiên "Cả hai" chỉ xem danh sách);
  // nhân viên cửa có thể chỉ có quyền "checkin" mà không có "view".
  // Điều hành: phiên trực tiếp không có phòng điều hành; quyền xét theo tổ chức
  // CỦA PHIÊN.
  const visible = new Set<SessionTab>(["tiep-thi", tab]);
  if (session.status !== "draft" && canViewContracts) visible.add("ho-so");
  if (session.status !== "draft" && (canViewContracts || canCheckIn)) visible.add("diem-danh");
  if (ONLINE_FORMATS.has(session.auction_format) && canRunAuction) visible.add("dieu-hanh");

  const confirmedDocs = UPLOADABLE_DOC_TYPES.filter((t) =>
    docs.some((d) => d.doc_type === t && d.review_status === "confirmed"),
  ).length;
  const pending = contracts.filter((c) => c.review_status === "pending").length;
  const counts: Partial<Record<SessionTab, TabCount>> = {
    "tai-san": { text: String(session.auction_session_items.length) },
  };
  if (session.status !== "cancelled" && confirmedDocs < UPLOADABLE_DOC_TYPES.length) {
    counts["tai-lieu"] = { text: `${confirmedDocs}/${UPLOADABLE_DOC_TYPES.length}` };
  }
  if (pending > 0) counts["ho-so"] = { text: String(pending), attention: true };

  return (
    <ConsignmentCanvas>
      <Crumb current={`${session.code} · ${session.title}`} />

      <SessionDetailHero
        session={session}
        isApproved={isApproved}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onEdit={() => navigate(`${LIST}/${session.id}/sua`)}
        onDeleted={() => navigate(LIST)}
      />

      <SessionDetailTabs tab={tab} visible={visible} counts={counts} onSelect={(t) => navigate(tabPath(t))} />

      {/* Mỗi tab là một route riêng nên chỉ một tab được dựng mỗi lần — không tab
          nào chạy query nền sau lưng tab đang mở. */}
      {tab === "thong-tin" && <SessionInfoTab session={session} />}
      {tab === "tai-san" && <SessionItemsTab session={session} auctionOrgId={auctionOrgId} canUpdate={canUpdate} />}
      {tab === "tai-lieu" && <SessionDocumentsTab session={session} canUpdate={canUpdate} />}
      {tab === "ho-so" && (
        <SessionContractsTab session={session} canView={canViewContracts} />
      )}
      {tab === "diem-danh" && <SessionCheckinTab session={session} />}
      {tab === "tiep-thi" && <SessionOutreachTab session={session} />}
      {tab === "dieu-hanh" && <SessionControlTab session={session} />}
    </ConsignmentCanvas>
  );
}
