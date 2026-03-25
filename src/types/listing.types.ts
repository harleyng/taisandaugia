export type ListingStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "SOLD" | "RENTED";
export type PriceUnit = "TOTAL" | "PER_SQM" | "PER_MONTH";
export type Purpose = "FOR_SALE" | "FOR_RENT";

export interface ListingAddress {
  province: string | null;
  district: string;
  ward: string | null;
  street: string | null;
}

export interface ListingAttributes {
  num_bedrooms?: number | null;
  num_bathrooms?: number | null;
  num_floors?: number | null;
  floor_number?: number | null;
  house_direction?: string | null;
  balcony_direction?: string | null;
  land_direction?: string | null;
  facade_width?: number | null;
  alley_width?: number | null;
  legal_status?: string | null;
  interior_status?: string | null;
  land_type?: string | null;
}

export interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

export interface Listing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  price_unit: PriceUnit;
  area: number;
  address: ListingAddress;
  purpose: Purpose;
  property_type_slug: string;
  image_url: string | null;
  status: ListingStatus;
  prominent_features: string[] | null;
  project_name: string | null;
  attributes: ListingAttributes;
  created_at: string;
  updated_at: string;
}
