import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Gavel, Loader2, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrgSessionRow } from "@/components/portal/auction-sessions/OrgSessionRow";
import { useOrgAuctionSessions, useSessionOrg } from "@/hooks/useAuctionSessions";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import {
  SESSION_BUCKET_LABELS,
  SESSION_BUCKET_ORDER,
  sessionBucketOf,
  type SessionBucket,
} from "@/lib/auctionSessions/phase";
import type { OrgSessionListRow } from "@/types/auction-session";

function StateCard({ icon, title, children }: { icon: ReactNode; title?: string; children: ReactNode }) {
  return (
    <div className="px-6 py-6">
      <Card className="space-y-3 rounded-2xl p-10 text-center">
        <div className="flex justify-center text-muted-foreground">{icon}</div>
        {title && <p className="font-semibold text-foreground">{title}</p>}
        <div className="text-sm text-muted-foreground">{children}</div>
      </Card>
    </div>
  );
}

/** /portal/phien-dau-gia — danh sách phiên đấu giá của tổ chức. */
export default function PhienDauGiaPage() {
  const navigate = useNavigate();
  const { auctionOrgId, isApproved, loading: orgLoading } = useSessionOrg();
  const { data: sessions = [], isLoading, error } = useOrgAuctionSessions();
  const canCreate = useHasOrgPermission("phien-dau-gia", "create");
  const [picked, setPicked] = useState<SessionBucket | null>(null);

  const grouped = useMemo(() => {
    const now = new Date();
    const map: Record<SessionBucket, OrgSessionListRow[]> = { draft: [], published: [], ended: [], cancelled: [] };
    for (const s of sessions) map[sessionBucketOf(s, now)].push(s);
    // Đang công bố: phiên sắp tới gần nhất lên đầu. Nhóm khác giữ thứ tự mới nhất trước.
    map.published.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    return map;
  }, [sessions]);

  // Chưa bấm tab nào ⇒ mở nhóm đầu tiên có phiên.
  const tab = picked ?? SESSION_BUCKET_ORDER.find((b) => grouped[b].length > 0) ?? "draft";
  const visible = grouped[tab];

  if (orgLoading || isLoading) {
    return (
      <StateCard icon={<Loader2 className="h-5 w-5 animate-spin" />}>Đang tải phiên đấu giá…</StateCard>
    );
  }

  if (!isApproved || !auctionOrgId) {
    return (
      <StateCard icon={<ShieldAlert className="h-9 w-9" />} title="Chưa thể tạo phiên đấu giá">
        Tổ chức cần được duyệt KYC và liên kết với danh bạ tổ chức đấu giá trước khi tạo và công bố phiên.
      </StateCard>
    );
  }

  if (error) {
    return (
      <StateCard icon={<ShieldAlert className="h-9 w-9" />} title="Không tải được danh sách phiên">
        Vui lòng tải lại trang.
      </StateCard>
    );
  }

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Phiên đấu giá</h1>
          <p className="text-sm text-muted-foreground">
            Gom tài sản vào phiên, khai báo lịch và công bố lên sàn cho người mua theo dõi.
          </p>
        </div>
        {canCreate && (
          <Button className="gap-1.5" onClick={() => navigate("/portal/phien-dau-gia/moi")}>
            <Plus className="h-4 w-4" />
            Tạo phiên
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {SESSION_BUCKET_ORDER.map((bucket) => (
          <Button
            key={bucket}
            variant={tab === bucket ? "default" : "outline"}
            size="sm"
            onClick={() => setPicked(bucket)}
            className="gap-1.5"
          >
            {SESSION_BUCKET_LABELS[bucket]}
            <span className={tab === bucket ? "opacity-80" : "text-muted-foreground"}>{grouped[bucket].length}</span>
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="space-y-3 rounded-2xl p-12 text-center">
          <Gavel className="mx-auto h-9 w-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {sessions.length === 0 ? "Tổ chức chưa có phiên đấu giá nào." : "Chưa có phiên nào trong mục này."}
          </p>
          {sessions.length === 0 && canCreate && (
            <Button variant="outline" onClick={() => navigate("/portal/phien-dau-gia/moi")}>
              Tạo phiên đầu tiên
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((s) => (
            <OrgSessionRow key={s.id} session={s} onOpen={() => navigate(`/portal/phien-dau-gia/${s.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
