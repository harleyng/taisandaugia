export type PartnerStatus = "active" | "inactive";

export interface PartnerStat {
  label: string;
  value: string;
}

export interface Partner {
  id: string;
  name: string;
  badge: string;
  accent_color: string;
  logo_url: string | null;
  logo_filter: string | null;
  tagline: string | null;
  description: string | null;
  stats: PartnerStat[];
  date_label: string | null;
  date_value: string | null;
  cta_text: string | null;
  cta_href: string | null;
  sort_order: number;
  status: PartnerStatus;
  created_at: string;
  updated_at: string;
}

export interface PartnerUpsert extends Partial<Partner> {
  id?: string;
  name: string;
}
