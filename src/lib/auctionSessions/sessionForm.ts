// Form khai báo phiên đấu giá: schema Zod + giá trị mặc định + quy đổi sang cột DB.
//
// Các luật thứ tự mốc thời gian ở đây là bản BÁO SỚM cho người dùng; nguồn sự
// thật là CHECK constraint trên auction_sessions. Sửa một bên nên sửa cả hai.

import { z } from "zod";
import type { AuctionSession, SessionInput } from "@/types/auction-session";
import { DEFAULT_CHECKIN_GRACE_MINUTES, DEFAULT_CHECKIN_LEAD_MINUTES } from "@/lib/biddingContracts/checkinWindow";
import { fromLocalInput, toLocalInput } from "./datetime";

const ms = (v: string | undefined) => (v ? new Date(v).getTime() : Number.NaN);
const bothSet = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b);

/** Khớp CHECK auction_sessions_checkin_lead_check / _grace_check (20261008100300). */
export const CHECKIN_LEAD_RANGE = { min: 15, max: 1440 } as const;
export const CHECKIN_GRACE_RANGE = { min: 0, max: 60 } as const;

/**
 * Hình thức chọn được cho phiên. "Cả hai hình thức" (ca_hai) đã bỏ: điểm danh suy kênh từ
 * hình thức (checkinChannelOf) nên ca_hai không điểm danh được. Schema vẫn NHẬN ca_hai để
 * phiên cũ mở form lên được, nhưng không cho lưu (DB CHECK giữ nguyên vì dữ liệu cũ).
 */
export const SESSION_FORMATS = ["truc_tiep", "truc_tuyen"] as const;
export const LEGACY_FORMAT_MESSAGE = "“Cả hai hình thức” không còn hỗ trợ — chọn Trực tiếp hoặc Trực tuyến";

const minutesIn = (range: { min: number; max: number }) =>
  z
    .string()
    .refine(
      (v) => /^\d+$/.test(v) && Number(v) >= range.min && Number(v) <= range.max,
      `Nhập số phút từ ${range.min} đến ${range.max}`,
    );

export const sessionFormSchema = z
  .object({
    title: z.string().trim().min(3, "Tên phiên tối thiểu 3 ký tự"),
    description: z.string().optional(),
    auction_format: z.enum(["truc_tiep", "truc_tuyen", "ca_hai"]),
    venue: z.string().optional(),
    province: z.string().optional(),
    max_registrants: z
      .string()
      .optional()
      .refine((v) => !v || (/^\d+$/.test(v) && Number(v) > 0), "Nhập số nguyên dương"),
    // Tiền bán hồ sơ tham gia. Trống / 0 = không bán hồ sơ qua sàn.
    dossier_fee: z
      .string()
      .optional()
      .refine((v) => !v || /^\d+$/.test(v), "Nhập số tiền hợp lệ"),
    registration_start_at: z.string().optional(),
    registration_end_at: z.string().optional(),
    viewing_start_at: z.string().optional(),
    viewing_end_at: z.string().optional(),
    starts_at: z.string().min(1, "Chọn thời gian bắt đầu đấu giá"),
    ends_at: z.string().min(1, "Chọn thời gian kết thúc"),
    // Cửa sổ điểm danh = [starts_at − lead, starts_at + grace].
    checkin_lead_minutes: minutesIn(CHECKIN_LEAD_RANGE),
    checkin_grace_minutes: minutesIn(CHECKIN_GRACE_RANGE),
  })
  .superRefine((v, ctx) => {
    const starts = ms(v.starts_at);
    const ends = ms(v.ends_at);
    const regStart = ms(v.registration_start_at);
    const regEnd = ms(v.registration_end_at);
    const viewStart = ms(v.viewing_start_at);
    const viewEnd = ms(v.viewing_end_at);

    if (v.auction_format === "ca_hai") {
      ctx.addIssue({ code: "custom", path: ["auction_format"], message: LEGACY_FORMAT_MESSAGE });
    }
    if (bothSet(starts, ends) && ends <= starts) {
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "Kết thúc phải sau thời điểm bắt đầu" });
    }
    if (bothSet(regEnd, starts) && regEnd > starts) {
      ctx.addIssue({ code: "custom", path: ["registration_end_at"], message: "Hạn nộp hồ sơ phải trước giờ đấu giá" });
    }
    if (bothSet(regStart, regEnd) && regStart > regEnd) {
      ctx.addIssue({ code: "custom", path: ["registration_end_at"], message: "Hạn nộp phải sau ngày mở bán hồ sơ" });
    }
    if (bothSet(viewStart, viewEnd) && viewStart > viewEnd) {
      ctx.addIssue({ code: "custom", path: ["viewing_end_at"], message: "Kết thúc xem tài sản phải sau ngày bắt đầu" });
    }
  });

export type SessionFormValues = z.infer<typeof sessionFormSchema>;

/** Phiên mới: đấu sau 14 ngày lúc 9:00–11:00, hạn nộp hồ sơ 17:00 trước đó 2 ngày. */
export function defaultSessionForm(now: Date = new Date()): SessionFormValues {
  const starts = new Date(now);
  starts.setDate(starts.getDate() + 14);
  starts.setHours(9, 0, 0, 0);
  const ends = new Date(starts);
  ends.setHours(11);
  const regStart = new Date(now);
  regStart.setHours(8, 0, 0, 0);
  const regEnd = new Date(starts);
  regEnd.setDate(regEnd.getDate() - 2);
  regEnd.setHours(17, 0, 0, 0);

  return {
    title: "",
    description: "",
    auction_format: "truc_tiep",
    venue: "",
    province: "",
    max_registrants: "",
    dossier_fee: "",
    registration_start_at: toLocalInput(regStart.toISOString()),
    registration_end_at: toLocalInput(regEnd.toISOString()),
    viewing_start_at: "",
    viewing_end_at: "",
    starts_at: toLocalInput(starts.toISOString()),
    ends_at: toLocalInput(ends.toISOString()),
    checkin_lead_minutes: String(DEFAULT_CHECKIN_LEAD_MINUTES),
    checkin_grace_minutes: String(DEFAULT_CHECKIN_GRACE_MINUTES),
  };
}

export function sessionToForm(s: AuctionSession): SessionFormValues {
  return {
    title: s.title,
    description: s.description ?? "",
    auction_format: s.auction_format,
    venue: s.venue ?? "",
    province: s.province ?? "",
    max_registrants: s.max_registrants != null ? String(s.max_registrants) : "",
    dossier_fee: s.dossier_fee != null && s.dossier_fee > 0 ? String(s.dossier_fee) : "",
    registration_start_at: toLocalInput(s.registration_start_at),
    registration_end_at: toLocalInput(s.registration_end_at),
    viewing_start_at: toLocalInput(s.viewing_start_at),
    viewing_end_at: toLocalInput(s.viewing_end_at),
    starts_at: toLocalInput(s.starts_at),
    ends_at: toLocalInput(s.ends_at),
    checkin_lead_minutes: String(s.checkin_lead_minutes ?? DEFAULT_CHECKIN_LEAD_MINUTES),
    checkin_grace_minutes: String(s.checkin_grace_minutes ?? DEFAULT_CHECKIN_GRACE_MINUTES),
  };
}

const text = (v: string | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

/** Gọi SAU khi schema đã parse thành công (starts_at / ends_at chắc chắn có). */
export function formToSessionInput(v: SessionFormValues): SessionInput {
  return {
    title: v.title.trim(),
    description: text(v.description),
    auction_format: v.auction_format,
    venue: text(v.venue),
    province: text(v.province),
    max_registrants: v.max_registrants ? Number(v.max_registrants) : null,
    dossier_fee: v.dossier_fee && Number(v.dossier_fee) > 0 ? Number(v.dossier_fee) : null,
    registration_start_at: fromLocalInput(v.registration_start_at),
    registration_end_at: fromLocalInput(v.registration_end_at),
    viewing_start_at: fromLocalInput(v.viewing_start_at),
    viewing_end_at: fromLocalInput(v.viewing_end_at),
    starts_at: fromLocalInput(v.starts_at) as string,
    ends_at: fromLocalInput(v.ends_at) as string,
    checkin_lead_minutes: Number(v.checkin_lead_minutes),
    checkin_grace_minutes: Number(v.checkin_grace_minutes),
  };
}
