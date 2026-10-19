import type { LegalPlatform } from "@/types/legal";

// Nền tảng của BẢN APP NÀY — file duy nhất khác nhau giữa taisandaugia ("info") và
// taisanviet ("auction"). Nhờ nó các file kernel dùng chung (AuthDialog,
// useLegalDocuments, useTermsGate, consent) giống hệt nhau ở hai repo mà vẫn đọc
// đúng Điều khoản / ghi đúng consent / gắn đúng signup_platform của nền tảng mình
// (docs/auction-platform-split-plan.md — Phase 4).
export const APP_PLATFORM: LegalPlatform = "info";
