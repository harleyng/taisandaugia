import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { AudienceCard } from "./AudienceCard";
import { CaseFileCard } from "./CaseFileCard";
import { ChannelDraftsCard } from "./ChannelDraftsCard";
import { MarkContactedDialog } from "./MarkContactedDialog";
import { MarkSentDialog } from "./MarkSentDialog";
import { NoticeCard } from "./NoticeCard";
import { OutreachToolbar } from "./OutreachToolbar";
import { SegmentPitchesCard } from "./SegmentPitchesCard";
import { SendLogCard } from "./SendLogCard";
import { useSessionOrg } from "@/hooks/useAuctionSessions";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { useSessionAudience } from "@/hooks/useSessionAudience";
import { useOutreachEdits, useOutreachOrgInfo, useOutreachPack, useOutreachSends } from "@/hooks/useSessionOutreach";
import { orgContactErrorMessage } from "@/lib/orgContacts/errors";
import { parseCaseFile } from "@/lib/outreach/caseFile";
import { pitchFieldKey, type SegmentKey } from "@/lib/outreach/fieldKeys";
import { buildNoticeFacts, inputFromSession, outreachSignature } from "@/lib/outreach/outreachInput";
import { canMarkSent } from "@/lib/outreach/sendWindow";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import type { AudienceRow } from "@/types/org-contacts";
import type { OutreachEdit, OutreachField, OutreachSendChannel } from "@/types/outreach";

/** Trang Tiếp thị phiên: hồ sơ vụ việc → thông báo → bản đăng → người nhận → câu chào → nhật ký. */
export function OutreachWorkspace({ session }: { session: AuctionSessionWithItems }) {
  const canUpdate = useHasOrgPermission("phien-dau-gia", "update");
  const canViewContacts = useHasOrgPermission("khach-hang", "view");
  const canContact = useHasOrgPermission("khach-hang", "update");
  const { auctionOrgId } = useSessionOrg();
  const lots = session.auction_session_items;

  const { data: state, isLoading, error } = useOutreachPack(session.id);
  const pack = state?.pack ?? null;
  const packId = pack?.id ?? null;
  const { data: edits = [] } = useOutreachEdits(session.id, packId);
  const { data: sends = [] } = useOutreachSends(session.id, packId);
  const { data: org } = useOutreachOrgInfo(session.auction_org_id);
  const { data: audience = [] } = useSessionAudience(session.id, [], canViewContacts && lots.length > 0);

  const [sentTarget, setSentTarget] = useState<{ channel: OutreachSendChannel; text: string } | null>(null);
  const [contactRows, setContactRows] = useState<AudienceRow[] | null>(null);

  const fieldsByKey = useMemo(() => new Map((state?.fields ?? []).map((f) => [f.field_key, f] as [string, OutreachField])), [state?.fields]);
  const editsByKey = useMemo(() => {
    const m = new Map<string, OutreachEdit[]>();
    for (const e of edits) m.set(e.field_key, [...(m.get(e.field_key) ?? []), e]);
    return m;
  }, [edits]);

  const input = useMemo(() => {
    if (!org) return null;
    const publicUrl = `${window.location.origin}/sessions/${session.id}`;
    return inputFromSession(session, org, parseCaseFile(pack?.case_file), audience, publicUrl);
  }, [session, org, pack?.case_file, audience]);
  const facts = useMemo(() => (input ? buildNoticeFacts(input) : null), [input]);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center gap-2 rounded-2xl p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang mở gói tiếp thị…
      </Card>
    );
  }
  if (error) return <InfoBox variant="amber" className="text-sm">{orgContactErrorMessage(error)}</InfoBox>;

  const readOnly = !canUpdate || session.status === "cancelled" || !packId;
  const sendAllowed = canMarkSent(session);
  const sendGate = {
    allowed: sendAllowed && !!packId,
    reason: sendAllowed
      ? null
      : session.status !== "published"
        ? "Công bố phiên trước khi đánh dấu đã gửi."
        : "Đã hết thời hạn nhận hồ sơ — không ghi nhận gửi thêm.",
  };
  const pitchFor = (seg: string) => fieldsByKey.get(pitchFieldKey(seg as SegmentKey))?.value ?? "";

  return (
    <div className="space-y-5">
      {!pack && (
        <InfoBox variant="amber" className="text-sm">
          Phiên chưa có gói tiếp thị và vai trò của bạn chưa được tạo gói. Nhờ Quản lý hoặc Chủ sở hữu mở trang này trước.
        </InfoBox>
      )}

      <OutreachToolbar
        sessionId={session.id}
        pack={pack}
        input={input}
        currentSignature={input ? outreachSignature(input) : null}
        readOnly={readOnly}
        hasFields={(state?.fields.length ?? 0) > 0}
      />

      <CaseFileCard session={session} pack={pack} auctionOrgId={auctionOrgId} readOnly={readOnly} />

      {facts && (
        <NoticeCard
          sessionId={session.id}
          pack={pack}
          facts={facts}
          fieldsByKey={fieldsByKey}
          editsByKey={editsByKey}
          readOnly={readOnly}
          canSend={sendGate.allowed && canUpdate}
          onMarkSent={(text) => setSentTarget({ channel: "notice", text })}
        />
      )}

      <ChannelDraftsCard
        sessionId={session.id}
        sessionTitle={session.title}
        packId={packId}
        fieldsByKey={fieldsByKey}
        editsByKey={editsByKey}
        sends={sends}
        readOnly={readOnly}
        sendGate={canUpdate ? sendGate : { allowed: false, reason: "Vai trò của bạn chưa được đánh dấu đăng tin." }}
        onMarkSent={(channel, text) => setSentTarget({ channel, text })}
      />

      <AudienceCard
        session={session}
        outreach={{
          sends,
          canContact: canContact && sendGate.allowed,
          contactBlockedReason: !canContact ? "Vai trò của bạn chưa được ghi nhận liên hệ khách hàng." : sendGate.reason,
          onContact: setContactRows,
        }}
      />

      <SegmentPitchesCard
        sessionId={session.id}
        packId={packId}
        audience={audience}
        lots={lots}
        fieldsByKey={fieldsByKey}
        editsByKey={editsByKey}
        readOnly={readOnly}
        canViewAudience={canViewContacts}
      />

      <SendLogCard sends={sends} />

      <MarkSentDialog sessionId={session.id} packId={packId} target={sentTarget} onClose={() => setSentTarget(null)} />
      <MarkContactedDialog
        sessionId={session.id}
        packId={packId}
        rows={contactRows}
        input={input}
        pitchFor={pitchFor}
        onClose={() => setContactRows(null)}
      />
    </div>
  );
}
