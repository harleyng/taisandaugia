import type { ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Gavel, Info, Loader2, Megaphone, Package, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionDetailHero } from "@/components/portal/auction-sessions/SessionDetailHero";
import { SessionFormCard } from "@/components/portal/auction-sessions/SessionFormCard";
import { SessionContractsTab } from "@/components/portal/auction-sessions/tabs/SessionContractsTab";
import { SessionControlTab } from "@/components/portal/auction-sessions/tabs/SessionControlTab";
import { SessionDocumentsTab } from "@/components/portal/auction-sessions/tabs/SessionDocumentsTab";
import { SessionInfoTab } from "@/components/portal/auction-sessions/tabs/SessionInfoTab";
import { SessionItemsTab } from "@/components/portal/auction-sessions/tabs/SessionItemsTab";
import { SessionOutreachTab } from "@/components/portal/auction-sessions/tabs/SessionOutreachTab";
import { useAuctionSession, useSessionOrg } from "@/hooks/useAuctionSessions";
import { useHasOrgPermission, useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";

export type SessionTab = "thong-tin" | "tai-san" | "tai-lieu" | "ho-so" | "tiep-thi" | "dieu-hanh";

const ONLINE_FORMATS = new Set(["truc_tuyen", "ca_hai"]);

/**
 * /portal/phien-dau-gia/moi và /portal/phien-dau-gia/:id — hero tóm tắt + 3 tab.
 *
 * Tab chạy trên ĐƯỜNG DẪN chứ không phải state hay ?tab=: ba route cũ
 * (`:id`, `:id/tiep-thi`, `:id/dieu-hanh`) vẫn còn nguyên, và quan trọng hơn,
 * `/dieu-hanh` được gác ở cấp route bằng module RIÊNG `dieu-hanh-dau-gia`
 * (App.tsx) — gộp thành một route là mất lớp gác đó.
 */
export default function PhienDauGiaDetailPage({ tab = "thong-tin" }: { tab?: SessionTab }) {
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
  // Theo tổ chức của PHIÊN — xem chú thích ở useHasOrgPermissionIn.
  const canRunAuction = useHasOrgPermissionIn(session?.organization_id, "dieu-hanh-dau-gia", "view");
  // Chế độ sửa nằm trên URL chứ không phải state: nút "Chỉnh sửa" bấm được từ
  // mọi tab, mà mỗi tab là một route — state sẽ mất khi điều hướng.
  const [searchParams] = useSearchParams();
  const editing = tab === "thong-tin" && searchParams.get("sua") === "1";

  const backToList = () => navigate("/portal/phien-dau-gia");

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

  // Phiên chưa tồn tại thì chưa có gì để chia tab — chỉ mỗi form khai báo.
  if (!session) {
    return shell(
      <>
        <div>
          <h1 className="text-xl font-bold text-foreground">Tạo phiên đấu giá</h1>
          <p className="text-sm text-muted-foreground">
            Khai báo thông tin và lịch phiên, lưu nháp rồi thêm tài sản trước khi công bố.
          </p>
        </div>
        <SessionFormCard
          session={null}
          readOnly={!canCreate}
          onCreated={(newId) => navigate(`/portal/phien-dau-gia/${newId}`, { replace: true })}
        />
        <Card className="rounded-2xl border-dashed p-6 text-center text-sm text-muted-foreground">
          Lưu nháp phiên để bắt đầu thêm tài sản.
        </Card>
      </>,
    );
  }

  const tabPath = (value: SessionTab) =>
    `/portal/phien-dau-gia/${session.id}${value === "thong-tin" ? "" : `/${value}`}`;

  // Hai tab dưới đây chỉ hiện khi có gì để xem — nhưng VẪN hiện nếu người dùng
  // đang đứng sẵn ở route đó, để họ không mất lối ra khỏi tab đang mở.
  // Hồ sơ: chỉ phiên đã công bố mới bán được hồ sơ.
  const showContractsTab = (session.status !== "draft" && canViewContracts) || tab === "ho-so";
  // Điều hành: phiên trực tiếp không có phòng điều hành; quyền xét theo tổ chức
  // CỦA PHIÊN.
  const showControlTab = (ONLINE_FORMATS.has(session.auction_format) && canRunAuction) || tab === "dieu-hanh";

  return shell(
    <>
      <SessionDetailHero
        session={session}
        isApproved={isApproved}
        canUpdate={canUpdate}
        canDelete={canDelete}
        editing={editing}
        onEdit={() => navigate(`${tabPath("thong-tin")}?sua=1`)}
        onDeleted={backToList}
      />

      <Tabs value={tab} onValueChange={(v) => navigate(tabPath(v as SessionTab))}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="thong-tin" className="gap-1.5">
            <Info className="h-4 w-4" />
            Thông tin
          </TabsTrigger>
          <TabsTrigger value="tai-san" className="gap-1.5">
            <Package className="h-4 w-4" />
            Tài sản trong phiên
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {session.auction_session_items.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="tai-lieu" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Tài liệu phiên
          </TabsTrigger>
          {showContractsTab && (
            <TabsTrigger value="ho-so" className="gap-1.5">
              <Users className="h-4 w-4" />
              Hồ sơ tham gia
            </TabsTrigger>
          )}
          <TabsTrigger value="tiep-thi" className="gap-1.5">
            <Megaphone className="h-4 w-4" />
            Tiếp thị phiên
          </TabsTrigger>
          {showControlTab && (
            <TabsTrigger value="dieu-hanh" className="gap-1.5">
              <Gavel className="h-4 w-4" />
              Điều hành phiên
            </TabsTrigger>
          )}
        </TabsList>

        {/* Mỗi tab là một route riêng nên chỉ một TabsContent được dựng mỗi lần —
            không tab nào chạy query nền sau lưng tab đang mở. */}
        <TabsContent value="thong-tin" className="mt-4">
          <SessionInfoTab
            session={session}
            editing={editing}
            onExitEdit={() => navigate(tabPath("thong-tin"), { replace: true })}
          />
        </TabsContent>

        <TabsContent value="tai-san" className="mt-4">
          <SessionItemsTab session={session} auctionOrgId={auctionOrgId} canUpdate={canUpdate} />
        </TabsContent>

        <TabsContent value="tai-lieu" className="mt-4">
          <SessionDocumentsTab session={session} canUpdate={canUpdate} />
        </TabsContent>

        <TabsContent value="ho-so" className="mt-4">
          <SessionContractsTab session={session} canView={canViewContracts} canUpdate={canUpdateContracts} />
        </TabsContent>

        <TabsContent value="tiep-thi" className="mt-4">
          <SessionOutreachTab session={session} />
        </TabsContent>

        <TabsContent value="dieu-hanh" className="mt-4">
          <SessionControlTab session={session} />
        </TabsContent>
      </Tabs>
    </>,
  );
}
