import { ASSET_CATEGORIES } from "@/constants/category.constants";
import type { OnboardingIntent, BudgetRange } from "./onboardingTasks";

const BUDGET_RANGES: Record<BudgetRange, { min: number; max: number }> = {
  "under-1b": { min: 0, max: 1_000_000_000 },
  "1-3b": { min: 1_000_000_000, max: 3_000_000_000 },
  "3-10b": { min: 3_000_000_000, max: 10_000_000_000 },
  "over-10b": { min: 10_000_000_000, max: Number.POSITIVE_INFINITY },
};

interface ListingLike {
  property_type_slug?: string | null;
  price?: number | null;
  address?: { province?: string | null } | null;
}

export const hasIntent = (intent?: OnboardingIntent | null): boolean => {
  if (!intent) return false;
  return Boolean(
    (intent.asset_categories && intent.asset_categories.length > 0) ||
      (intent.regions && intent.regions.length > 0) ||
      intent.budget_range
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

export const matchListingToIntent = (
  listing: ListingLike,
  intent?: OnboardingIntent | null
): boolean => {
  if (!intent) return false;
  // Categories
  if (intent.asset_categories && intent.asset_categories.length > 0) {
    if (!listing.property_type_slug) return false;
    if (!matchesCategory(listing.property_type_slug, intent.asset_categories)) return false;
  }
  // Regions
  if (intent.regions && intent.regions.length > 0) {
    const province = listing.address?.province;
    if (!province) return false;
    if (!intent.regions.includes(province)) return false;
  }
  // Budget
  if (intent.budget_range) {
    const range = BUDGET_RANGES[intent.budget_range];
    const price = listing.price ?? 0;
    if (price < range.min || price > range.max) return false;
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
