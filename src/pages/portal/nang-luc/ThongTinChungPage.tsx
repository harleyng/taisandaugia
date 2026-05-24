import { useState, useEffect } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pencil, AlertTriangle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useGeneralInfo } from '@/hooks/useGeneralInfo'
import { CompanyProfileCard } from '@/components/general-info/CompanyProfileCard'
import { MOJDirectoryStatusCard } from '@/components/general-info/MOJDirectoryStatusCard'
import { OperationYearsCard } from '@/components/general-info/OperationYearsCard'
import { EstablishmentDocumentsCard } from '@/components/general-info/EstablishmentDocumentsCard'
import { BranchesCard } from '@/components/general-info/BranchesCard'
import { BankAccountsCard } from '@/components/general-info/BankAccountsCard'
import { BranchFormDialog } from '@/components/general-info/BranchFormDialog'
import { BankAccountFormDialog } from '@/components/general-info/BankAccountFormDialog'
import { EditInfoSheet } from '@/components/general-info/EditInfoSheet'
import type { OrgGeneralInfo, Branch, BankAccount, OrgType } from '@/types/general-info'
import type { EditFormValues } from '@/components/general-info/EditInfoSheet'

// Map auction_organizations.org_type (number) to our OrgType enum
function mapOrgType(n: number | null): OrgType {
  if (n === 1) return 'TRUNG_TAM_DV'
  if (n === 3) return 'DN_TU_NHAN'
  return 'CONG_TY_HOP_DANH' // default / 2
}

async function fetchLinkedAuctionOrg(): Promise<Partial<OrgGeneralInfo> | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: orgs } = await supabase
    .from('organizations')
    .select('license_info, kyc_status')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const org = orgs?.[0] ?? null

  if (!org?.license_info) return null

  const auctionOrgId = (org.license_info as Record<string, unknown>)?.auction_org_id as string | undefined
  if (!auctionOrgId) return null

  const { data: company } = await supabase
    .from('auction_organizations')
    .select('id, name, tax_code, address, province, phone, email, logo_url, org_type, created_at')
    .eq('id', auctionOrgId)
    .maybeSingle()

  if (!company) return null

  return {
    name: company.name,
    orgType: mapOrgType(company.org_type),
    taxCode: company.tax_code ?? '',
    address: company.address ?? '',
    province: company.province ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    logoUrl: company.logo_url ?? undefined,
    isListedInMOJDirectory: true,
    foundedDate: '',
    legalRepName: '',
    bankAccounts: [],
    branches: [],
  }
}

export default function ThongTinChungPage() {
  const {
    generalInfo,
    yearsOfOperation,
    mucIV5Score,
    save,
    addBranch,
    updateBranch,
    removeBranch,
    addBankAccount,
    updateBankAccount,
    removeBankAccount,
  } = useGeneralInfo()

  const [editOpen, setEditOpen] = useState(false)
  const [branchDialog, setBranchDialog] = useState<{ open: boolean; existing?: Branch }>({ open: false })
  const [bankDialog, setBankDialog] = useState<{ open: boolean; existing?: BankAccount }>({ open: false })
  const [prefilling, setPrefilling] = useState(false)
  const [prefillDone, setPrefillDone] = useState(false)

  // Auto-prefill from Supabase when no local data exists
  useEffect(() => {
    if (generalInfo !== null || prefillDone) return
    setPrefilling(true)
    fetchLinkedAuctionOrg()
      .then((partial) => {
        // Always initialize — with Supabase data if available, otherwise empty
        save({ ...emptyInfo(), ...(partial ?? {}) } as OrgGeneralInfo)
      })
      .catch(() => {
        save(emptyInfo())
      })
      .finally(() => {
        setPrefilling(false)
        setPrefillDone(true)
      })
  }, [generalInfo, prefillDone, save])

  const handleEditSave = (values: EditFormValues, branches: Branch[], bankAccounts: BankAccount[]) => {
    save({
      ...generalInfo!,
      ...values,
      isListedInMOJDirectory: true,
      website: values.website || undefined,
      alternativeEmail: values.alternativeEmail || undefined,
      branches,
      bankAccounts,
    })
  }

  // Show skeleton while fetching Supabase
  if (prefilling) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!generalInfo) return null

  // Compute missing fields for the alert banner
  const missingFields: string[] = []
  if (!generalInfo.legalRepName) missingFields.push('Đại diện pháp lý')
  if (!generalInfo.foundedDate) missingFields.push('Ngày thành lập')
  if (!generalInfo.address) missingFields.push('Địa chỉ')
  if (!generalInfo.phone) missingFields.push('Số điện thoại')
  if (!generalInfo.establishmentDecisionFile) missingFields.push('Quyết định thành lập')
  if (!generalInfo.businessLicenseFile) missingFields.push('Giấy đăng ký hoạt động')

  const lastUpdated = generalInfo.updatedAt
    ? (() => { try { const d = parseISO(generalInfo.updatedAt); return isValid(d) ? format(d, 'dd/MM/yyyy') : null } catch { return null } })()
    : null

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-foreground">Thông tin chung</h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Cập nhật lần cuối: {lastUpdated}
              {generalInfo.lastUpdatedBy ? ` bởi ${generalInfo.lastUpdatedBy}` : ''}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Sửa thông tin
        </Button>
      </div>

      {/* Missing info alert */}
      {missingFields.length > 0 && (
        <Alert variant="destructive" className="border-warning/40 bg-warning/5 text-warning-foreground [&>svg]:text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <span className="font-medium">Hồ sơ chưa đầy đủ</span> — còn thiếu:{' '}
            <span className="font-medium">{missingFields.join(', ')}</span>.{' '}
            Nhấn <strong>Sửa thông tin</strong> để bổ sung.
          </AlertDescription>
        </Alert>
      )}

      {/* MOJ confirmed status */}
      <MOJDirectoryStatusCard />

      {/* Operation years / IV.5 score */}
      {yearsOfOperation && (
        <OperationYearsCard yearsOfOperation={yearsOfOperation} score={mucIV5Score} />
      )}

      {/* Main company info card */}
      <CompanyProfileCard info={generalInfo} onEdit={() => setEditOpen(true)} />

      {/* Establishment documents */}
      <EstablishmentDocumentsCard info={generalInfo} />

      {/* Branches */}
      <BranchesCard
        branches={generalInfo.branches}
        onAdd={() => setBranchDialog({ open: true })}
        onEdit={(b) => setBranchDialog({ open: true, existing: b })}
        onRemove={removeBranch}
      />

      {/* Bank accounts */}
      <BankAccountsCard
        accounts={generalInfo.bankAccounts}
        onAdd={() => setBankDialog({ open: true })}
        onEdit={(a) => setBankDialog({ open: true, existing: a })}
        onRemove={removeBankAccount}
      />

      {/* Edit Sheet */}
      <EditInfoSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        info={generalInfo}
        onSave={handleEditSave}
      />

      {/* Branch dialog (from view mode) */}
      <BranchFormDialog
        open={branchDialog.open}
        onOpenChange={(o) => setBranchDialog({ open: o })}
        existing={branchDialog.existing}
        onSave={(branch) => {
          if (branchDialog.existing) {
            updateBranch({ ...branch, id: branchDialog.existing.id })
          } else {
            addBranch(branch)
          }
        }}
      />

      {/* Bank account dialog (from view mode) */}
      <BankAccountFormDialog
        open={bankDialog.open}
        onOpenChange={(o) => setBankDialog({ open: o })}
        existing={bankDialog.existing}
        onSave={(account) => {
          if (bankDialog.existing) {
            updateBankAccount({ ...account, id: bankDialog.existing.id })
          } else {
            addBankAccount(account)
          }
        }}
      />
    </div>
  )
}

function emptyInfo(): OrgGeneralInfo {
  const now = new Date().toISOString()
  return {
    id: '',
    name: '',
    orgType: 'CONG_TY_HOP_DANH',
    taxCode: '',
    address: '',
    province: '',
    phone: '',
    email: '',
    legalRepName: '',
    foundedDate: '',
    isListedInMOJDirectory: true,
    bankAccounts: [],
    branches: [],
    createdAt: now,
    updatedAt: now,
  }
}
