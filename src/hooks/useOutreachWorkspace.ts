import { useMemo } from "react";
import { useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { useOutreachChannels } from "@/hooks/useOutreachChannels";
import { useOutreachOrgInfo, useOutreachPack } from "@/hooks/useSessionOutreach";
import { buildBulletin } from "@/lib/outreach/bulletin";
import { parseCaseFile } from "@/lib/outreach/caseFile";
import { registrationLink } from "@/lib/outreach/channels";
import type { AuctionSessionWithItems } from "@/types/auction-session";

/**
 * Dữ liệu tab Tiếp thị: gói (bài chung), hồ sơ vụ việc → tiêu đề bản tin, kênh, quyền.
 * Quyền xét theo TỔ CHỨC CỦA PHIÊN.
 */
export function useOutreachWorkspace(session: AuctionSessionWithItems) {
  const canUpdate = useHasOrgPermissionIn(session.organization_id, "phien-dau-gia", "update");

  const packQ = useOutreachPack(session.id);
  const pack = packQ.data?.pack ?? null;
  const packId = pack?.id ?? null;
  const channelsQ = useOutreachChannels(session.id, packId);
  const { data: org } = useOutreachOrgInfo(session.auction_org_id);

  const caseFile = useMemo(() => parseCaseFile(pack?.case_file), [pack?.case_file]);
  const bulletin = useMemo(() => buildBulletin(caseFile, session), [caseFile, session]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const linkFor = (src?: string | null) => registrationLink(origin, session.id, src);

  return {
    session,
    orgName: org?.name ?? "Tổ chức đấu giá",
    pack,
    packId,
    loading: packQ.isLoading || (!!packId && channelsQ.isLoading),
    error: packQ.error,
    caseFile,
    bulletin,
    channels: channelsQ.data ?? [],
    linkFor,
    /** Viết / sửa bài (phiên chưa huỷ + quyền sửa phiên). */
    canEdit: canUpdate && session.status !== "cancelled" && !!packId,
  };
}

export type OutreachWorkspace = ReturnType<typeof useOutreachWorkspace>;
