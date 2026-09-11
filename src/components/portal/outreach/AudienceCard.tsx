import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, FileDown, Loader2, MessageCircleMore, Users, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InfoBox } from "@/components/shared/InfoBox";
import { MultiSelectField } from "@/components/admin/marketing/audience/MultiSelectField";
import { ContactConsentBadge } from "@/components/portal/org-contacts/ContactConsentBadge";
import { AudienceLotCoverage } from "./AudienceLotCoverage";
import { AudienceTable } from "./AudienceTable";
import { SaveAudienceGroupDialog } from "./SaveAudienceGroupDialog";
import { useOrgContactGroups } from "@/hooks/useOrgContactGroups";
import { useOrgContacts } from "@/hooks/useOrgContacts";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { useSessionAudience } from "@/hooks/useSessionAudience";
import { exportAudienceXlsx } from "@/lib/orgContacts/audienceExport";
import { orgContactErrorMessage } from "@/lib/orgContacts/errors";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import type { AudienceRow } from "@/types/org-contacts";
import type { OutreachSend } from "@/types/outreach";

interface OutreachHooks {
  sends: OutreachSend[];
  canContact: boolean;
  contactBlockedReason: string | null;
  onContact: (rows: AudienceRow[]) => void;
}

/** Danh sách người nhận của phiên — kết quả truy vấn org_session_audience. */
export function AudienceCard({ session, outreach }: { session: AuctionSessionWithItems; outreach?: OutreachHooks }) {
  const navigate = useNavigate();
  const canView = useHasOrgPermission("khach-hang", "view");
  const canExport = useHasOrgPermission("khach-hang", "export");
  const canCreateGroup = useHasOrgPermission("khach-hang", "create");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveOpen, setSaveOpen] = useState(false);

  const lots = session.auction_session_items;
  const { data: groups = [] } = useOrgContactGroups();
  const { data: contacts = [], isLoading: contactsLoading } = useOrgContacts();
  const { data: rows = [], isLoading, error } = useSessionAudience(session.id, groupIds, canView && lots.length > 0);

  const lotsById = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);
  const interestsById = useMemo(
    () => new Map(contacts.flatMap((c) => c.org_contact_interests.map((i) => [i.id, i] as const))),
    [contacts],
  );
  // sends đã sắp mới nhất trước ⇒ lần gặp đầu là lần liên hệ gần nhất.
  const contactedAt = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of outreach?.sends ?? []) if (s.contact_id && !m.has(s.contact_id)) m.set(s.contact_id, s.marked_at);
    return m;
  }, [outreach?.sends]);
  const groupName = (id: string) => groups.find((g) => g.id === id)?.name;
  const eligible = rows.filter((r) => r.eligible);
  const ineligible = rows.filter((r) => !r.eligible);
  const selectedRows = eligible.filter((r) => selected.has(r.contact_id));

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <UsersRound className="h-4 w-4" />
          Người nhận
        </h2>
        <p className="text-sm text-muted-foreground">
          Khách trong danh bạ của tổ chức có nhu cầu khớp ít nhất một lô theo loại tài sản, tỉnh/thành và khoảng giá
          khởi điểm. Chỉ khách đang theo dõi và đã đồng ý nhận tin mới được gửi. Không chấm điểm.
        </p>
      </div>
      {canView && eligible.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {outreach && (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!outreach.canContact || selectedRows.length === 0}
              title={outreach.canContact ? undefined : outreach.contactBlockedReason ?? undefined}
              onClick={() => outreach.onContact(selectedRows)}
            >
              <MessageCircleMore className="h-4 w-4" />
              Ghi nhận đã liên hệ{selectedRows.length ? ` (${selectedRows.length})` : ""}
            </Button>
          )}
          {canCreateGroup && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSaveOpen(true)}>
              <Users className="h-4 w-4" />
              Lưu thành nhóm
            </Button>
          )}
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportAudienceXlsx(rows, lots, groupName, session.code ?? session.id)}
            >
              <FileDown className="h-4 w-4" />
              Xuất Excel
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const body = () => {
    if (!canView) {
      return <InfoBox variant="amber" className="text-sm">Vai trò của bạn chưa được xem danh bạ khách hàng nên không xem được người nhận.</InfoBox>;
    }
    if (lots.length === 0) {
      return <p className="text-sm text-muted-foreground">Phiên chưa có tài sản — thêm tài sản để chọn người nhận.</p>;
    }
    if (isLoading || contactsLoading) {
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang chọn người nhận…
        </p>
      );
    }
    if (error) return <InfoBox variant="amber" className="text-sm">{orgContactErrorMessage(error)}</InfoBox>;
    if (contacts.length === 0) {
      return (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Danh bạ khách hàng của tổ chức đang trống.{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => navigate("/portal/khach-hang")}>
            Thêm hoặc import khách hàng
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <AudienceLotCoverage lots={lots} rows={rows} />
        {eligible.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có khách đủ điều kiện gửi cho phiên này
            {groupIds.length ? " trong các nhóm đã chọn" : ""}.
          </p>
        ) : (
          <AudienceTable
            rows={eligible}
            lotsById={lotsById}
            interestsById={interestsById}
            groupName={groupName}
            selection={outreach ? { selected, onChange: setSelected } : undefined}
            contactedAt={contactedAt}
          />
        )}
        {ineligible.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              {ineligible.length} khách khớp nhu cầu nhưng không được gửi
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <ul className="divide-y rounded-xl border text-sm">
                {ineligible.map((r) => (
                  <li key={r.contact_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <span className="font-medium text-foreground">{r.full_name}</span>
                      <span className="text-muted-foreground"> · Lô {r.matched_lot_nos.join(", ")}</span>
                    </span>
                    <ContactConsentBadge enabled={r.notifications_enabled} status={r.status} />
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  };

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      {header}
      {canView && lots.length > 0 && groups.length > 0 && (
        <div className="max-w-md">
          <MultiSelectField
            options={groups.map((g) => ({ value: g.id, label: `${g.name} (${g.member_count})` }))}
            selected={groupIds}
            onChange={(ids) => {
              setGroupIds(ids);
              setSelected(new Set());
            }}
            placeholder="Mọi nhóm khách hàng"
            searchable
            maxBadges={3}
          />
        </div>
      )}
      {body()}
      <SaveAudienceGroupDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        contactIds={eligible.map((r) => r.contact_id)}
        defaultName={`Người nhận ${session.code ?? ""}`.trim()}
        defaultDescription={`Khách khớp nhu cầu phiên "${session.title}"`}
      />
    </Card>
  );
}
