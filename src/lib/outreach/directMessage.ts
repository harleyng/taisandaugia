// Tin nhắn gửi TỪNG KHÁCH = câu chào của phân khúc + ĐÚNG các lô khách đó khớp.
// Danh sách lô lấy từ kết quả org_session_audience (matched_item_ids), không do
// trình soạn quyết định.

import { shortOrgName } from "./generateOutreach";
import { shortDate, viDateTime, vnd } from "./format";
import type { OutreachLot, OutreachOrg } from "./outreachInput";
import { composeSms } from "./sms";

export type DirectMethod = "sms" | "zalo" | "call" | "email";

export const DIRECT_METHOD_LABELS: Record<DirectMethod, string> = {
  zalo: "Zalo",
  sms: "SMS",
  call: "Gọi điện",
  email: "Email",
};

export interface DirectMessageInput {
  method: DirectMethod;
  contactName: string;
  pitch: string;
  /** Chỉ các lô khách này khớp. */
  lots: OutreachLot[];
  session: { code: string | null; starts_at: string; registration_end_at: string | null };
  org: OutreachOrg;
  publicUrl: string;
}

export function composeDirectMessage(i: DirectMessageInput): string {
  const lots = [...i.lots].sort((a, b) => a.lot_no - b.lot_no);
  const code = i.session.code ?? "";

  if (i.method === "sms") {
    return composeSms({
      lead: `[${shortOrgName(i.org.name)}] ${code}:`,
      subject: i.pitch,
      details: [lots.length ? `Lo ${lots.map((l) => l.lot_no).join(",")}` : "", `DG ${shortDate(i.session.starts_at)}`],
      link: i.publicUrl,
    });
  }

  const lines = [
    `Chào anh/chị ${i.contactName.trim()},`,
    i.pitch.trim(),
    lots
      .map((l) => `• Lô ${l.lot_no}: ${l.title}${l.starting_price != null ? ` — giá khởi điểm ${vnd(l.starting_price)}` : ""}`)
      .join("\n"),
    [
      `Đấu giá: ${viDateTime(i.session.starts_at)}.`,
      i.session.registration_end_at ? `Nhận hồ sơ đến ${viDateTime(i.session.registration_end_at)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    `Chi tiết: ${i.publicUrl}`,
    `${i.org.name}${i.org.phone ? ` — ${i.org.phone}` : ""}`,
  ];
  if (i.method === "call") lines.splice(0, 1, `Kịch bản gọi cho ${i.contactName.trim()}:`);
  return lines.filter(Boolean).join("\n\n");
}
