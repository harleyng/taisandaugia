export type OrganizationKycStatus = "NOT_APPLIED" | "PENDING_KYC" | "APPROVED" | "REJECTED";
export type MembershipStatus = "PENDING_INVITE" | "ACTIVE" | "INACTIVE";
export type OrganizationRoleName = "Owner" | "Manager" | "Agent";

export interface LicenseInfo {
  businessLicenseNumber?: string;
  taxId?: string;
  address?: string;
  legalRepresentative?: string;
  phoneNumber?: string;
  registrationDate?: string;
  businessLicenseUrl?: string;
  taxCertificateUrl?: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  kyc_status: OrganizationKycStatus;
  license_info: any; // Json type from Supabase
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRole {
  id: string;
  name: string; // Can be 'Owner' | 'Manager' | 'Agent'
  permissions: any; // Json type from Supabase
  description: string | null;
  created_at: string;
}

export interface OrganizationMembership {
  id: string;
  user_id: string | null;
  organization_id: string;
  role_id: string;
  status: MembershipStatus;
  invited_by: string | null;
  invite_token: string | null;
  invite_email: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipWithDetails extends OrganizationMembership {
  organization?: Organization;
  role?: OrganizationRole;
  user?: { id: string; email: string; name: string | null };
  inviter?: { id: string; email: string; name: string | null };
}
