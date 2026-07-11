import { z } from "zod";

// Scalar fields managed by react-hook-form. Rich content (content_html) and the
// audience spec live in useState alongside the form (mirrors AdminArticleEditor,
// where the TipTap `content` is held outside RHF).
export const campaignSchema = z.object({
  name: z.string().min(3, "Tên chiến dịch tối thiểu 3 ký tự"),
  notes: z.string().optional().or(z.literal("")),
  subject: z.string().max(150, "Tối đa 150 ký tự").optional().or(z.literal("")),
  preview_text: z.string().max(140, "Tối đa 140 ký tự").optional().or(z.literal("")),
  schedule_type: z.enum(["immediate", "scheduled"]),
  scheduled_at: z.string().optional().or(z.literal("")),
});

export type CampaignFormValues = z.infer<typeof campaignSchema>;

export const campaignDefaults: CampaignFormValues = {
  name: "",
  notes: "",
  subject: "",
  preview_text: "",
  schedule_type: "immediate",
  scheduled_at: "",
};
