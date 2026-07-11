import type {
  AudienceSpec,
  CampaignScheduleType,
  CampaignStatus,
} from "@/types/marketing";
import { hasAnyAudience } from "./audienceCriteria";

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Bản nháp",
  scheduled: "Lên lịch",
  sending: "Đang gửi",
  sent: "Hoàn thành",
  ended: "Đã huỷ",
};

// Palette classes (codebase uses raw Tailwind palette for status pills).
export const STATUS_BADGE_CLASS: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-amber-100 text-amber-700",
  sending: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  ended: "bg-gray-200 text-gray-600",
};

export interface StatusTab {
  key: CampaignStatus | "all";
  label: string;
}

export const STATUS_TABS: StatusTab[] = [
  { key: "all", label: "Tất cả" },
  { key: "draft", label: "Bản nháp" },
  { key: "scheduled", label: "Lên lịch" },
  { key: "sending", label: "Đang gửi" },
  { key: "sent", label: "Hoàn thành" },
  { key: "ended", label: "Đã huỷ" },
];

/** Chiến dịch đã gửi/lên lịch/đang gửi thì không cho sửa nữa. */
export function isEditable(status: CampaignStatus): boolean {
  return status === "draft";
}

// ─── Section completion (for the review sidebar / progress ring) ─────────────

export interface CampaignSectionInput {
  name: string;
  subject: string;
  contentHtml: string;
  scheduleType: CampaignScheduleType;
  scheduledAt: string;
  spec: AudienceSpec;
}

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

export interface CampaignSectionStatus {
  basic: { done: boolean };
  audience: { done: boolean };
  content: { done: boolean };
  schedule: { done: boolean };
  all: boolean;
  progress: number;
}

export function campaignSectionStatus(input: CampaignSectionInput): CampaignSectionStatus {
  const basic = { done: input.name.trim().length >= 3 };
  const audience = { done: hasAnyAudience(input.spec) };
  const content = {
    done: input.subject.trim().length > 0 && stripHtml(input.contentHtml).length > 0,
  };
  const schedule = {
    done:
      input.scheduleType === "immediate" ||
      (input.scheduleType === "scheduled" && input.scheduledAt.trim().length > 0),
  };
  const doneCount = [basic, audience, content, schedule].filter((s) => s.done).length;
  return {
    basic,
    audience,
    content,
    schedule,
    all: doneCount === 4,
    progress: doneCount / 4,
  };
}

export type CampaignSection = "basic" | "audience" | "content" | "schedule";

export const SECTION_META: { id: CampaignSection; label: string }[] = [
  { id: "basic", label: "Thông tin cơ bản" },
  { id: "audience", label: "Đối tượng nhận" },
  { id: "content", label: "Nội dung email" },
  { id: "schedule", label: "Lịch gửi" },
];
