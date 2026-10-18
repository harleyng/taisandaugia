import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { OutreachWorkspace } from "@/hooks/useOutreachWorkspace";
import { useSessionOrg } from "@/hooks/useAuctionSessions";
import { qk } from "@/lib/queryKeys";
import { orgContactErrorMessage } from "@/lib/orgContacts/errors";
import { writeChannelPost, writeSharedPost, type WriteOptions, type WriterContext } from "@/lib/outreach/aiWriter";
import { sortLots, totalDeposit, totalStartingPrice, viDate } from "@/lib/outreach/bulletin";
import { caseLot, prefillCaseFile, type ConsignmentSource, type ListingSource } from "@/lib/outreach/caseFile";
import type { ChannelKind } from "@/lib/outreach/channels";
import { viRange, vnd } from "@/lib/outreach/format";

/**
 * Nguồn mô tả của lô ngoài hồ sơ vụ việc: tin đăng + hồ sơ ký gửi. Ô hồ sơ vụ việc
 * còn trống được điền từ đây (prefillCaseFile) — không ghi lại vào gói.
 */
function usePrefillSources(ws: OutreachWorkspace) {
  const { auctionOrgId } = useSessionOrg();
  const items = ws.session.auction_session_items;
  const listingIds = items.map((i) => i.listing_id).filter((x): x is string => !!x);
  const needPostings = items.some((i) => !!i.asset_posting_id);
  return useQuery({
    queryKey: [...qk.sessionOutreach.bySession(ws.session.id), "prefill", listingIds.join(","), needPostings, auctionOrgId],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ listings: ListingSource[]; consignments: ConsignmentSource[] }> => {
      let listings: ListingSource[] = [];
      if (listingIds.length) {
        const { data, error } = await supabase.from("listings").select("id, description, legal_status, image_url").in("id", listingIds);
        if (error) throw error;
        listings = (data ?? []) as ListingSource[];
      }
      let consignments: ConsignmentSource[] = [];
      if (needPostings && auctionOrgId) {
        const { data, error } = await supabase.rpc("org_service_requests", { _auction_org_id: auctionOrgId });
        if (error) throw error;
        consignments = (data ?? []) as unknown as ConsignmentSource[];
      }
      return { listings, consignments };
    },
  });
}

/** Dữ liệu bộ viết được đọc — chỉ từ phiên, lô và hồ sơ vụ việc. */
export function useWriterContext(ws: OutreachWorkspace): WriterContext {
  const { data: src } = usePrefillSources(ws);
  return useMemo(() => {
    const s = ws.session;
    const items = sortLots(s.auction_session_items);
    const cf = prefillCaseFile(ws.caseFile, items, src?.listings ?? [], src?.consignments ?? []);
    return {
      orgName: ws.orgName,
      head: ws.bulletin.head,
      totalStart: totalStartingPrice(items),
      totalDeposit: totalDeposit(items),
      regEnd: viDate(s.registration_end_at),
      auctionDate: viDate(s.starts_at),
      viewing: viRange(s.viewing_start_at, s.viewing_end_at),
      province: s.province,
      lots: items.map((l) => {
        const c = caseLot(cf, l.id);
        return {
          lot_no: l.lot_no,
          title: l.title,
          starting_price: l.starting_price != null ? vnd(l.starting_price) : "",
          place: [l.district, l.province].filter(Boolean).join(", "),
          description: c.description,
          condition: c.condition,
          legal: c.legal_summary,
        };
      }),
      link: ws.linkFor,
    };
  }, [ws, src]);
}

/**
 * SEAM đổi sang mô hình AI thật: thay thân hàm bằng
 *   supabase.functions.invoke("write-outreach", { body: { ctx, kind, options } })
 * miễn trả về văn bản thuần. Hôm nay: bộ viết mẫu tất định + độ trễ giả.
 */
export async function writePost(ctx: WriterContext, kind: ChannelKind | null, o: WriteOptions): Promise<string> {
  await new Promise((r) => window.setTimeout(r, 900));
  return kind ? writeChannelPost(ctx, kind, o) : writeSharedPost(ctx, o);
}

export function useSavePost(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { packId: string; text: string; options?: WriteOptions; generated?: boolean }) => {
      const { error } = await supabase.rpc("outreach_save_post", {
        _pack_id: v.packId,
        _text: v.text,
        _options: (v.options ?? null) as unknown as Json,
        _generated: !!v.generated,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sessionOutreach.bySession(sessionId), exact: true }),
    onError: (e) => toast.error(orgContactErrorMessage(e)),
  });
}
