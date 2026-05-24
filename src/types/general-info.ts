export type OrgType =
  | 'TRUNG_TAM_DV'     // Trung tâm dịch vụ đấu giá tài sản
  | 'CONG_TY_HOP_DANH' // Công ty đấu giá hợp danh
  | 'DN_TU_NHAN'       // Doanh nghiệp đấu giá tư nhân

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  TRUNG_TAM_DV: 'Trung tâm dịch vụ đấu giá tài sản',
  CONG_TY_HOP_DANH: 'Công ty đấu giá hợp danh',
  DN_TU_NHAN: 'Doanh nghiệp đấu giá tư nhân',
}

export interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountHolder: string
  branch?: string
  isPrimary: boolean
}

export interface Branch {
  id: string
  name: string
  type: 'BRANCH' | 'REP_OFFICE'
  address: string
  province: string
  district?: string
  ward?: string
  phone?: string
  email?: string
  managerName?: string
  establishedDate?: string
  isActive: boolean
}

export interface OrgGeneralInfo {
  id: string

  // Identity
  name: string
  shortName?: string
  orgType: OrgType
  taxCode: string
  registrationCode?: string

  // Logo
  logoUrl?: string
  logoInitials?: string
  brandColor?: string

  // Address
  address: string
  ward?: string
  district?: string
  province: string

  // Contact
  phone: string
  alternativePhone?: string
  fax?: string
  email: string
  alternativeEmail?: string
  website?: string

  // Legal representative
  legalRepName: string
  legalRepPosition?: string
  legalRepIdNumber?: string
  legalRepIdIssuedDate?: string
  legalRepIdIssuedPlace?: string

  // Establishment
  foundedDate: string
  establishmentDecisionNumber?: string
  establishmentDecisionDate?: string
  establishmentDecisionIssuer?: string
  establishmentDecisionFile?: string

  businessLicenseNumber?: string
  businessLicenseDate?: string
  businessLicenseIssuer?: string
  businessLicenseFile?: string

  // MOJ Directory
  isListedInMOJDirectory: boolean
  mojListingNotes?: string

  // Related collections
  bankAccounts: BankAccount[]
  branches: Branch[]

  // Audit
  createdAt: string
  updatedAt: string
  lastUpdatedBy?: string
}
