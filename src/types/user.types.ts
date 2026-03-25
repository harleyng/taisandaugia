export type KycStatus = "NOT_APPLIED" | "PENDING_KYC" | "APPROVED" | "REJECTED";
export type UserRole = "USER" | "BROKER" | "ADMIN";

export interface AgentInfo {
  company_name: string;
  license_number: string;
  address: string;
  phone: string;
  website?: string;
  profile_picture_url?: string;
  license_document_url?: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  kyc_status: KycStatus;
  agent_info: AgentInfo | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}
