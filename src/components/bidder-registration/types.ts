import type { RegistrationFormValues } from "@/lib/biddingContracts/registrationForm";
import type { GroupedIssues } from "@/lib/biddingContracts/resubmitForm";

export type UploadSlot = "principal" | "proxy" | "regDoc" | "poa";

/** Props chung của các bước: form do RegistrationWizard giữ, bước chỉ đọc + vá. */
export interface StepProps {
  values: RegistrationFormValues;
  patch: (p: Partial<RegistrationFormValues>) => void;
  errors: GroupedIssues;
  /** Đang gửi đăng ký — khoá mọi ô. */
  submitting: boolean;
  /** Đang gửi HOẶC đang tải tệp — khoá ô không phải ô ảnh. */
  busy: boolean;
  /** Mỗi tệp vừa tải — wizard dọn tệp không dùng khi rời trang. */
  onUploaded: (path: string) => void;
  /** Ổn định qua các lần render (IdentityCapture đặt nó vào deps của effect). */
  busyHandlers: Record<UploadSlot, (busy: boolean) => void>;
}
