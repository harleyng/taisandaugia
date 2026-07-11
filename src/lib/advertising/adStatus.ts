import type { AdStatus, AdStartType, AdEndType, NavType } from "@/types/advertising";

export const STATUS_LABELS: Record<AdStatus, string> = {
  draft: "Bản nháp",
  scheduled: "Lên lịch",
  active: "Đang hiển thị",
  paused: "Tạm dừng",
  ended: "Kết thúc",
};

// Palette classes (đồng bộ với Email Marketing — dùng raw Tailwind palette cho pill).
export const STATUS_BADGE_CLASS: Record<AdStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-orange-100 text-orange-700",
  ended: "bg-gray-200 text-gray-600",
};

export interface StatusTab {
  key: AdStatus | "all";
  label: string;
}

export const STATUS_TABS: StatusTab[] = [
  { key: "all", label: "Tất cả" },
  { key: "draft", label: "Bản nháp" },
  { key: "scheduled", label: "Lên lịch" },
  { key: "active", label: "Đang hiển thị" },
  { key: "paused", label: "Tạm dừng" },
  { key: "ended", label: "Kết thúc" },
];

/** Chỉ được sửa khi ở trạng thái nháp hoặc đã lên lịch (giống ảnh tham khảo). */
export function isEditable(status: AdStatus): boolean {
  return status === "draft" || status === "scheduled";
}

export const NAV_TYPE_LABELS: Record<NavType, string> = {
  none: "Không điều hướng",
  link: "Link điều hướng",
};

// ─── Section completion (review panel / progress ring) ───────────────────────

export interface AdSectionInput {
  name: string;
  positionId: string;
  showDesktop: boolean;
  showMobile: boolean;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  startType: AdStartType;
  startAt: string;
  endType: AdEndType;
  endAt: string;
}

export interface AdSectionStatus {
  basic: { done: boolean };
  content: { done: boolean };
  schedule: { done: boolean };
  all: boolean;
  progress: number;
}

export function adSectionStatus(input: AdSectionInput): AdSectionStatus {
  const basic = { done: input.name.trim().length >= 3 };

  const anyDevice = input.showDesktop || input.showMobile;
  const desktopOk = !input.showDesktop || !!input.desktopImageUrl;
  const mobileOk = !input.showMobile || !!input.mobileImageUrl;
  const content = {
    done: !!input.positionId && anyDevice && desktopOk && mobileOk,
  };

  const startOk =
    input.startType === "immediate" ||
    (input.startType === "scheduled" && input.startAt.trim().length > 0);
  const endOk =
    input.endType === "continuous" ||
    (input.endType === "scheduled" && input.endAt.trim().length > 0);
  const schedule = { done: startOk && endOk };

  const doneCount = [basic, content, schedule].filter((s) => s.done).length;
  return {
    basic,
    content,
    schedule,
    all: doneCount === 3,
    progress: doneCount / 3,
  };
}

export type AdSection = "basic" | "content" | "schedule";

export const SECTION_META: { id: AdSection; label: string }[] = [
  { id: "basic", label: "Thông tin cơ bản" },
  { id: "content", label: "Nội dung Banner" },
  { id: "schedule", label: "Lịch đăng" },
];
