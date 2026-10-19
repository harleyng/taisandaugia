import { auctionUrl } from "@/lib/auctionPlatform";
import { LEGAL_DOC_HREFS, type LegalDocType, type LegalPlatform } from "@/types/legal";

/** `?platform=` của các trang /admin/phap-ly — mặc định Tài Sản Đấu Giá. */
export const parseLegalPlatform = (value: string | null): LegalPlatform =>
  value === "auction" ? "auction" : "info";

const withPlatform = (path: string, platform: LegalPlatform, extra?: string) => {
  const qs = [platform === "info" ? null : `platform=${platform}`, extra].filter(Boolean).join("&");
  return qs ? `${path}?${qs}` : path;
};

export const adminLegalListPath = (platform: LegalPlatform) => withPlatform("/admin/phap-ly", platform);

export const adminLegalCreatePath = (platform: LegalPlatform, docType: LegalDocType, fromId?: string) =>
  withPlatform("/admin/phap-ly/tao", platform, `type=${docType}${fromId ? `&from=${fromId}` : ""}`);

/** Trang công khai của văn bản. Văn bản của sàn nằm ở tên miền sàn. */
export const legalPublicUrl = (platform: LegalPlatform, docType: LegalDocType): string =>
  platform === "info" ? LEGAL_DOC_HREFS[docType] : auctionUrl(LEGAL_DOC_HREFS[docType]);
