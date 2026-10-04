// Form tạo / sửa link Hồ sơ online — luật khớp posting_share_validate ở server.

import { z } from "zod";
import { MKT_CHANNELS } from "@/lib/ownerMarketing/links";
import { expiryDays, DEFAULT_SHARE_EXPIRY, type ShareExpiryValue } from "./status";
import type { PostingShareLink, ShareLinkInput } from "./types";

/** "keep" chỉ có ở chế độ sửa: giữ nguyên hạn hiện tại. */
export const KEEP_EXPIRY = "keep" as const;
export type ShareExpiryChoice = ShareExpiryValue | typeof KEEP_EXPIRY;

// z.enum cần tuple literal — giữ khớp SHARE_EXPIRY_OPTIONS (test ở form.test.ts).
const EXPIRY_VALUES = ["7", "30", "90", "none", KEEP_EXPIRY] as const satisfies readonly ShareExpiryChoice[];

export const shareLinkSchema = z
  .object({
    label: z.string().trim().min(1, "Nhập tên gợi nhớ, vd. “Anh Minh – KHDN”").max(80, "Tối đa 80 ký tự"),
    channel: z.enum(MKT_CHANNELS, { errorMap: () => ({ message: "Chọn kênh gửi link" }) }),
    /** Thành viên gửi link — tên + SĐT lấy từ hồ sơ của họ, không gõ tay. */
    senderUserId: z.string().nullable(),
    showPrice: z.boolean(),
    showExactAddress: z.boolean(),
    showSenderContact: z.boolean(),
    expiry: z.enum(EXPIRY_VALUES),
  })
  .superRefine((v, ctx) => {
    if (v.showSenderContact && !v.senderUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["senderUserId"],
        message: "Chọn người gửi để hiện liên hệ cho khách",
      });
    }
  });

export type ShareLinkForm = z.infer<typeof shareLinkSchema>;

/** Tạo mới: người gửi mặc định là người đang tạo (`defaultSenderId`). */
export function shareLinkDefaults(link?: PostingShareLink | null, defaultSenderId: string | null = null): ShareLinkForm {
  if (!link) {
    return {
      label: "",
      channel: "zalo",
      senderUserId: defaultSenderId,
      showPrice: false,
      showExactAddress: false,
      showSenderContact: false,
      expiry: DEFAULT_SHARE_EXPIRY,
    };
  }
  return {
    label: link.label,
    channel: (MKT_CHANNELS as readonly string[]).includes(link.channel) ? (link.channel as ShareLinkForm["channel"]) : "other",
    senderUserId: link.senderUserId,
    showPrice: link.showPrice,
    showExactAddress: link.showExactAddress,
    showSenderContact: link.showSenderContact,
    expiry: KEEP_EXPIRY,
  };
}

/** Giá trị form → tham số RPC. `changeExpiry` false khi người dùng giữ nguyên hạn. */
export function toShareLinkInput(v: ShareLinkForm): { input: ShareLinkInput; changeExpiry: boolean } {
  const changeExpiry = v.expiry !== KEEP_EXPIRY;
  return {
    changeExpiry,
    input: {
      label: v.label.trim(),
      channel: v.channel,
      senderUserId: v.senderUserId,
      showPrice: v.showPrice,
      showExactAddress: v.showExactAddress,
      showSenderContact: v.showSenderContact,
      expiresInDays: changeExpiry ? expiryDays(v.expiry as ShareExpiryValue) : null,
    },
  };
}
