// Pure helpers cho hệ thống nhiệm vụ onboarding 2 tầng.
// Data lưu trong profiles.agent_info (jsonb) ở Supabase.

export const REWARD_BASIC_CREDITS = 59;
export const REWARD_INTENT_CREDITS = 108;
export const REWARD_BASIC_TOKENS = 1;
export const REWARD_INTENT_TOKENS = 1;

export type UserRole = "buyer" | "investor" | "broker" | "company";
export type Gender = "male" | "female" | "other";
export type BudgetRange = "under-1b" | "1-3b" | "3-10b" | "over-10b";
export type Experience = "new" | "1-3y" | "over-3y" | "pro";
export type IntentGoal = "live-in" | "invest" | "flip" | "other";
export type SourceChannel = "facebook" | "google" | "friend" | "other";

export type SessionStatusKey = "registration_open" | "upcoming" | "ongoing";
export type LegalCategoryKey = "thi-hanh-an" | "no-xau" | "thanh-ly" | "pha-san" | "khac";

export interface OnboardingBasic {
  phone?: string;
  phone_verified?: boolean;
  role?: UserRole;
  province?: string;
  /** ISO date string yyyy-mm-dd */
  birth_date?: string;
  /** @deprecated kept for backward compat with older saved profiles */
  birth_year?: number;
  gender?: Gender;
}

export interface IntentRegion {
  province: string;
  districts?: string[];
}

export interface OnboardingIntent {
  /** Flat list of category slugs (parent or child). */
  asset_categories?: string[];
  /** Region selections with optional districts per province. */
  regions?: IntentRegion[];
  /** Use địa chỉ sau sáp nhập. */
  merged_address?: boolean;
  /** Giá khởi điểm range (VNĐ). */
  price_min?: number | null;
  price_max?: number | null;
  /** Tiền đặt trước range (VNĐ). */
  deposit_min?: number | null;
  deposit_max?: number | null;
  /** Multi-select pháp lý. */
  legal_categories?: LegalCategoryKey[];
  /** Multi-select trạng thái phiên. */
  session_statuses?: SessionStatusKey[];

  /** @deprecated cũ – không còn dùng cho matching */
  budget_range?: BudgetRange;
  /** @deprecated */
  experience?: Experience;
  /** @deprecated */
  goal?: IntentGoal;
  /** @deprecated */
  source?: SourceChannel;
}

export const DEFAULT_SESSION_STATUSES: SessionStatusKey[] = [
  "registration_open",
  "upcoming",
  "ongoing",
];

export interface OnboardingRewards {
  basic_completed_at?: number | null;
  basic_claimed_at?: number | null;
  intent_completed_at?: number | null;
  intent_claimed_at?: number | null;
}

export interface AgentInfoShape {
  profile_picture_url?: string | null;
  basic?: OnboardingBasic;
  intent?: OnboardingIntent;
  rewards?: OnboardingRewards;
  [k: string]: unknown;
}

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "buyer", label: "Người mua" },
  { value: "investor", label: "Nhà đầu tư" },
  { value: "broker", label: "Môi giới" },
  { value: "company", label: "Doanh nghiệp" },
];

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Khác" },
];

export const BUDGET_OPTIONS: { value: BudgetRange; label: string }[] = [
  { value: "under-1b", label: "Dưới 1 tỷ" },
  { value: "1-3b", label: "1 – 3 tỷ" },
  { value: "3-10b", label: "3 – 10 tỷ" },
  { value: "over-10b", label: "Trên 10 tỷ" },
];

export const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: "new", label: "Mới bắt đầu" },
  { value: "1-3y", label: "1 – 3 năm" },
  { value: "over-3y", label: "Trên 3 năm" },
  { value: "pro", label: "Chuyên nghiệp" },
];

export const GOAL_OPTIONS: { value: IntentGoal; label: string }[] = [
  { value: "live-in", label: "Mua để ở" },
  { value: "invest", label: "Đầu tư dài hạn" },
  { value: "flip", label: "Lướt sóng" },
  { value: "other", label: "Khác" },
];

export const SOURCE_OPTIONS: { value: SourceChannel; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "friend", label: "Bạn bè giới thiệu" },
  { value: "other", label: "Khác" },
];

export const isBasicComplete = (basic?: OnboardingBasic, name?: string | null): boolean => {
  if (!basic) return false;
  return Boolean(
    name &&
      name.trim() &&
      basic.phone &&
      basic.phone_verified &&
      basic.role &&
      basic.province &&
      (basic.birth_date || basic.birth_year) &&
      basic.gender
  );
};

export const isIntentComplete = (intent?: OnboardingIntent): boolean => {
  if (!intent) return false;
  return Boolean(
    intent.asset_categories &&
      intent.asset_categories.length > 0 &&
      intent.regions &&
      intent.regions.length > 0 &&
      intent.budget_range &&
      intent.experience &&
      intent.goal &&
      intent.source
  );
};

export type TaskStatus = "todo" | "ready" | "claimed";

export interface OnboardingTask {
  key: "basic" | "intent";
  title: string;
  description: string;
  credits: number;
  tokens: number;
  status: TaskStatus;
  anchor: string;
}

export const buildTasks = (
  agentInfo: AgentInfoShape | null | undefined,
  name: string | null | undefined
): OnboardingTask[] => {
  const basic = agentInfo?.basic;
  const intent = agentInfo?.intent;
  const rewards = agentInfo?.rewards ?? {};

  const basicComplete = isBasicComplete(basic, name);
  const intentComplete = isIntentComplete(intent);

  const basicStatus: TaskStatus = rewards.basic_claimed_at
    ? "claimed"
    : basicComplete
      ? "ready"
      : "todo";

  const intentStatus: TaskStatus = rewards.intent_claimed_at
    ? "claimed"
    : intentComplete
      ? "ready"
      : "todo";

  return [
    {
      key: "basic",
      title: "Hoàn thành hồ sơ cá nhân",
      description: "Cập nhật thông tin để xác thực và cá nhân hóa trải nghiệm",
      credits: REWARD_BASIC_CREDITS,
      tokens: REWARD_BASIC_TOKENS,
      status: basicStatus,
      anchor: "/profile#basic",
    },
    {
      key: "intent",
      title: "Khai báo nhu cầu đấu giá",
      description: "Giúp chúng tôi gợi ý tài sản phù hợp với bạn",
      credits: REWARD_INTENT_CREDITS,
      tokens: REWARD_INTENT_TOKENS,
      status: intentStatus,
      anchor: "/profile#intent",
    },
  ];
};

export const getAvailableRewardCredits = (tasks: OnboardingTask[]): number =>
  tasks.filter((t) => t.status === "ready").reduce((sum, t) => sum + t.credits, 0);

export const hasUnclaimedRewards = (tasks: OnboardingTask[]): boolean =>
  tasks.some((t) => t.status === "ready");

export const allClaimed = (tasks: OnboardingTask[]): boolean =>
  tasks.every((t) => t.status === "claimed");
