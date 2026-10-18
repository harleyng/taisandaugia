import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { DetailNote, TabHeader } from "../DetailCard";
import { OutreachWriter } from "@/components/portal/outreach/OutreachWriter";
import { useOutreachWorkspace } from "@/hooks/useOutreachWorkspace";
import { orgContactErrorMessage } from "@/lib/orgContacts/errors";
import type { AuctionSessionWithItems } from "@/types/auction-session";

/**
 * Tab "Tiếp thị phiên" — bản MVP (design "Phien Dau Gia - Cong Cong Ty MVP",
 * pdg-mvp3.js `outreachTab`): AI viết một bài chung cho mọi tài sản, viết riêng từng kênh.
 */
export function SessionOutreachTab({ session }: { session: AuctionSessionWithItems }) {
  const ws = useOutreachWorkspace(session);

  return (
    <div className="flex flex-col gap-5">
      <TabHeader title="Tiếp thị phiên" description="AI viết sẵn một bài chung cho mọi tài sản từ hồ sơ phiên. Sao chép để đăng, hoặc viết riêng cho từng kênh." />

      {session.status === "cancelled" ? (
        <DetailNote icon={<AlertTriangle />}>Phiên đã huỷ — không đăng thông tin tiếp thị nữa.</DetailNote>
      ) : (
        session.status === "draft" && (
          <DetailNote tone="muted" icon={<Info />}>
            Soạn sẵn được nội dung; chỉ đăng sau khi công bố phiên.
          </DetailNote>
        )
      )}

      {ws.loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-card p-10 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang mở gói tiếp thị…
        </div>
      ) : ws.error ? (
        <DetailNote icon={<AlertTriangle />}>{orgContactErrorMessage(ws.error)}</DetailNote>
      ) : !ws.pack ? (
        <DetailNote icon={<AlertTriangle />}>
          Phiên chưa có gói tiếp thị và vai trò của bạn chưa được tạo gói. Nhờ Quản lý hoặc Chủ sở hữu mở tab này trước.
        </DetailNote>
      ) : (
        <OutreachWriter ws={ws} />
      )}
    </div>
  );
}
