// Form "Yêu cầu tư vấn đấu giá" của người bán — luật khớp owner_request_auction_consult.

import { z } from "zod";

const money = z
  .string()
  .trim()
  .refine((s) => s === "" || /^\d+$/.test(s), "Chỉ nhập số")
  .refine((s) => s === "" || Number(s) > 0, "Số tiền phải lớn hơn 0");

const todayIso = () => new Date().toISOString().slice(0, 10);
const maxDeadlineIso = () => new Date(Date.now() + 730 * 86_400_000).toISOString().slice(0, 10);

export const requestConsultSchema = z
  .object({
    saleGoal: z.enum(["fastest", "max_price", "balanced"], { required_error: "Chọn mục tiêu bán" }),
    expectedPrice: money,
    minPrice: money,
    timeline: z.enum(["", "urgent", "normal", "flexible"]),
    deadline: z
      .string()
      .refine((s) => s === "" || (s >= todayIso() && s <= maxDeadlineIso()), "Hạn chót từ hôm nay đến tối đa 2 năm tới"),
    note: z.string().max(2000, "Tối đa 2.000 ký tự"),
  })
  .refine((v) => !v.expectedPrice || !v.minPrice || Number(v.minPrice) <= Number(v.expectedPrice), {
    path: ["minPrice"],
    message: "Không được cao hơn giá mong muốn",
  });

export type RequestConsultValues = z.infer<typeof requestConsultSchema>;

export interface RequestConsultPrefill {
  startingPrice?: number | null;
  expectedTimeline?: string | null;
}

export function requestDefaults(prefill?: RequestConsultPrefill): RequestConsultValues {
  const tl = prefill?.expectedTimeline;
  return {
    saleGoal: undefined as unknown as RequestConsultValues["saleGoal"],
    expectedPrice: prefill?.startingPrice ? String(prefill.startingPrice) : "",
    minPrice: "",
    timeline: tl === "urgent" || tl === "normal" || tl === "flexible" ? tl : "",
    deadline: "",
    note: "",
  };
}
