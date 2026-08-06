import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { getSessionStatus } from "@/hooks/useAuctionListings";
import { caNumber, caString, type ListingCustomAttributes } from "@/types/listing";
import type { OnboardingIntent } from "./onboardingTasks";

interface ListingLike {
  property_type_slug?: string | null;
  price?: number | null;
  address?: { province?: string | null; district?: string | null } | null;
  custom_attributes?: ListingCustomAttributes | null;
  status?: string;
}

export const hasIntent = (intent?: OnboardingIntent | null): boolean => {
  if (!intent) return false;
  return Boolean(
    (intent.asset_categories && intent.asset_categories.length > 0) ||
      (intent.regions && intent.regions.length > 0) ||
      intent.price_min != null ||
      intent.price_max != null ||
      intent.deposit_min != null ||
      intent.deposit_max != null ||
      (intent.legal_categories && intent.legal_categories.length > 0) ||
      (intent.session_statuses && intent.session_statuses.length > 0)
  );
};

const matchesCategory = (listingSlug: string, selected: string[]): boolean => {
  if (!selected || selected.length === 0) return true;
  for (const sel of selected) {
    if (sel === listingSlug) return true;
    const parent = ASSET_CATEGORIES.find((c) => c.slug === sel);
    if (parent && parent.children.some((ch) => ch.slug === listingSlug)) return true;
  }
  return false;
};

const matchesRegion = (
  province: string | null | undefined,
  district: string | null | undefined,
  regions: NonNullable<OnboardingIntent["regions"]>
): boolean => {
  if (!regions || regions.length === 0) return true;
  if (!province) return false;
  const r = regions.find((x) => x.province === province);
  if (!r) return false;
  if (!r.districts || r.districts.length === 0) return true;
  if (!district) return false;
  return r.districts.includes(district);
};

export const matchListingToIntent = (
  listing: ListingLike,
  intent?: OnboardingIntent | null
): boolean => {
  if (!intent) return false;

  if (intent.asset_categories && intent.asset_categories.length > 0) {
    if (!listing.property_type_slug) return false;
    if (!matchesCategory(listing.property_type_slug, intent.asset_categories)) return false;
  }

  if (intent.regions && intent.regions.length > 0) {
    if (!matchesRegion(listing.address?.province, listing.address?.district, intent.regions)) {
      return false;
    }
  }

  const price = listing.price ?? 0;
  if (intent.price_min != null && price < intent.price_min) return false;
  if (intent.price_max != null && price > intent.price_max) return false;

  const deposit = caNumber(listing.custom_attributes?.deposit_amount);
  if (intent.deposit_min != null) {
    if (deposit == null || deposit < intent.deposit_min) return false;
  }
  if (intent.deposit_max != null) {
    if (deposit == null || deposit > intent.deposit_max) return false;
  }

  if (intent.legal_categories && intent.legal_categories.length > 0) {
    const lc = caString(listing.custom_attributes?.legal_category);
    // includes() trên mảng union hẹp không nhận `string`; so khớp thủ công để
    // khỏi phải ép kiểu.
    if (!lc || !intent.legal_categories.some((c) => c === lc)) return false;
  }

  if (intent.session_statuses && intent.session_statuses.length > 0) {
    const status = getSessionStatus({
      status: listing.status,
      custom_attributes: listing.custom_attributes,
    });
    if (!intent.session_statuses.some((s) => s === status)) return false;
  }

  return true;
};

export const countMatches = (
  listings: ListingLike[],
  intent?: OnboardingIntent | null
): number => {
  if (!hasIntent(intent)) return 0;
  return listings.reduce((n, l) => (matchListingToIntent(l, intent) ? n + 1 : n), 0);
};
