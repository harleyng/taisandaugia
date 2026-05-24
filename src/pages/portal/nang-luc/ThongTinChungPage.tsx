import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useGeneralInfo } from '@/hooks/useGeneralInfo'
import { ScoreInlineBar } from '@/components/portal/ScoreInlineBar'
import { ScoreBreakdownDialog } from '@/components/portal/ScoreBreakdownDialog'
import { MUC_IV5_BREAKDOWN } from '@/lib/portal/scoreBreakdowns'
import { CompanyProfileCard } from '@/components/general-info/CompanyProfileCard'
import { GeneralInfoSuggestionsCard } from '@/components/general-info/GeneralInfoSuggestionsCard'
import { EstablishmentDocumentsCard } from '@/components/general-info/EstablishmentDocumentsCard'
import { ProfileEditCard } from '@/components/general-info/ProfileEditCard'
import { DocsEditCard } from '@/components/general-info/DocsEditCard'
import { BranchesCard } from '@/components/general-info/BranchesCard'
import { BranchFormDialog } from '@/components/general-info/BranchFormDialog'
import { editSchema, buildDefaults } from '@/components/general-info/EditInfoSheet'
import type { EditFormValues } from '@/components/general-info/EditInfoSheet'
import type { OrgGeneralInfo, Branch, OrgType } from '@/types/general-info'

type EditingSection = 'profile' | 'docs' | null

function mapOrgType(n: number | null): OrgType {
  if (n === 1) return 'TRUNG_TAM_DV'
  if (n === 3) return 'DN_TU_NHAN'
  return 'CONG_TY_HOP_DANH'
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
  } = useGeneralInfo()

  const [editingSection, setEditingSection] = useState<EditingSection>(null)
  const [saving, setSaving] = useState(false)
  const [branchDialog, setBranchDialog] = useState<{ open: boolean; existing?: Branch }>({ open: false })
  const [prefilling, setPrefilling] = useState(false)
  const [prefillDone, setPrefillDone] = useState(false)

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: buildDefaults(emptyInfo()),
  })

  // Sync form when generalInfo loads or changes
  useEffect(() => {
    if (generalInfo) form.reset(buildDefaults(generalInfo))
  }, [generalInfo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-prefill from Supabase on first load
  useEffect(() => {
    if (generalInfo !== null || prefillDone) return
    setPrefilling(true)
    fetchLinkedAuctionOrg()
      .then((partial) => { save({ ...emptyInfo(), ...(partial ?? {}) } as OrgGeneralInfo) })
      .catch(() => { save(emptyInfo()) })
      .finally(() => { setPrefilling(false); setPrefillDone(true) })
  }, [generalInfo, prefillDone, save])

  const handleSaveProfile = async () => {
    const profileFields: (keyof EditFormValues)[] = [
      'name', 'orgType', 'taxCode', 'address', 'province', 'phone', 'email', 'legalRepName',
    ]
    const isValid = await form.trigger(profileFields)
    if (!isValid) return
    setSaving(true)
    try {
      const v = form.getValues()
      save({
        ...generalInfo!,
        name: v.name, shortName: v.shortName || undefined,
        orgType: v.orgType, taxCode: v.taxCode,
        registrationCode: v.registrationCode || undefined,
        logoUrl: v.logoUrl || undefined,
        address: v.address, ward: v.ward || undefined,
        district: v.district || undefined, province: v.province,
        phone: v.phone, alternativePhone: v.alternativePhone || undefined,
        fax: v.fax || undefined, email: v.email,
        alternativeEmail: v.alternativeEmail || undefined,
        website: v.website || undefined,
        legalRepName: v.legalRepName,
        legalRepPosition: v.legalRepPosition || undefined,
        legalRepIdNumber: v.legalRepIdNumber || undefined,
        legalRepIdIssuedDate: v.legalRepIdIssuedDate || undefined,
        legalRepIdIssuedPlace: v.legalRepIdIssuedPlace || undefined,
        isListedInMOJDirectory: true,
      })
      toast.success('Đã lưu thông tin tổ chức')
      setEditingSection(null)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDocs = () => {
    const v = form.getValues()
    save({
      ...generalInfo!,
      foundedDate: v.foundedDate,
      establishmentDecisionNumber: v.establishmentDecisionNumber || undefined,
      establishmentDecisionDate: v.establishmentDecisionDate || undefined,
      establishmentDecisionIssuer: v.establishmentDecisionIssuer || undefined,
      establishmentDecisionFile: v.establishmentDecisionFile || undefined,
      businessLicenseNumber: v.businessLicenseNumber || undefined,
      businessLicenseDate: v.businessLicenseDate || undefined,
      businessLicenseIssuer: v.businessLicenseIssuer || undefined,
      businessLicenseFile: v.businessLicenseFile || undefined,
      isListedInMOJDirectory: true,
    })
    toast.success('Đã lưu giấy tờ pháp lý')
    setEditingSection(null)
  }

  if (prefilling) {
    return (
      <div className="px-6 py-6 space-y-5">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (!generalInfo) return null

  return (
    <div className="px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Thông tin chung</h1>
        <div className="flex items-center gap-1.5">
          <ScoreInlineBar label="Mục IV.5" score={mucIV5Score} max={4} />
          <ScoreBreakdownDialog data={MUC_IV5_BREAKDOWN} />
        </div>
      </div>

      <GeneralInfoSuggestionsCard
        info={generalInfo}
        yearsOfOperation={yearsOfOperation}
        mucIV5Score={mucIV5Score}
        onEdit={(section) => {
          setEditingSection(section)
          setTimeout(() => {
            document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth' })
          }, 50)
        }}
      />

      <div id="section-profile">
        {editingSection === 'profile' ? (
          <ProfileEditCard
            form={form}
            saving={saving}
            onSave={handleSaveProfile}
            onCancel={() => setEditingSection(null)}
          />
        ) : (
          <CompanyProfileCard info={generalInfo} onEdit={() => setEditingSection('profile')} />
        )}
      </div>

      <div id="section-docs">
        {editingSection === 'docs' ? (
          <DocsEditCard
            form={form}
            saving={saving}
            onSave={handleSaveDocs}
            onCancel={() => setEditingSection(null)}
          />
        ) : (
          <EstablishmentDocumentsCard info={generalInfo} onEdit={() => setEditingSection('docs')} />
        )}
      </div>

      <BranchesCard
        branches={generalInfo.branches}
        onAdd={() => setBranchDialog({ open: true })}
        onEdit={(b) => setBranchDialog({ open: true, existing: b })}
        onRemove={removeBranch}
      />

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
    </div>
  )
}

function emptyInfo(): OrgGeneralInfo {
  const now = new Date().toISOString()
  return {
    id: '', name: '', orgType: 'CONG_TY_HOP_DANH',
    taxCode: '', address: '', province: '', phone: '', email: '',
    legalRepName: '', foundedDate: '', isListedInMOJDirectory: true,
    bankAccounts: [], branches: [], createdAt: now, updatedAt: now,
  }
}
