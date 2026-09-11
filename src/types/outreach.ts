// Gói tiếp thị phiên — bảng + RPC: supabase/migrations/20260912000013_session_outreach.sql.

import type { Tables } from "@/integrations/supabase/types";
import type { DirectMethod } from "@/lib/outreach/directMessage";

export type OutreachEditKind = "generate" | "regenerate" | "suggest" | "edit" | "reset" | "case_file";
export type OutreachFieldOrigin = "generated" | "edited";
export type OutreachSendChannel = "listing" | "zalo" | "facebook" | "sms" | "flyer" | "notice";

export type OutreachPack = Tables<"session_outreach_packs">;

export type OutreachField = Omit<Tables<"session_outreach_fields">, "origin"> & { origin: OutreachFieldOrigin };

export type OutreachEdit = Omit<Tables<"session_outreach_edits">, "kind"> & { kind: OutreachEditKind };

export type OutreachSend = Omit<Tables<"session_outreach_sends">, "channel" | "contact_method"> & {
  channel: OutreachSendChannel | null;
  contact_method: DirectMethod | null;
};

export interface OutreachPackState {
  /** null = phiên chưa có gói và người xem không có quyền tạo. */
  pack: OutreachPack | null;
  fields: OutreachField[];
}

export interface ContactOutreachHistoryRow extends OutreachSend {
  session_outreach_packs: {
    session_id: string;
    auction_sessions: { code: string | null; title: string } | null;
  } | null;
}
