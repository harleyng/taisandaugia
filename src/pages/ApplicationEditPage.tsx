import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useApplication } from '@/hooks/useApplication'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useCapacityProfile } from '@/hooks/useCapacityProfile'
import { ApplicationScoreHeader } from '@/components/applications/ApplicationScoreHeader'
import { Section1Announcement } from '@/components/applications/sections/Section1Announcement'
import { Section2CapacitySummary } from '@/components/applications/sections/Section2CapacitySummary'
import { Section3AuctionPlan } from '@/components/applications/sections/Section3AuctionPlan/Section3AuctionPlan'
import { Section4SectionVCriteria } from '@/components/applications/sections/Section4Criteria/Section4SectionVCriteria'
import { Section5Export } from '@/components/applications/sections/Section5Export/Section5Export'
import { CopyFromPreviousModal } from '@/components/applications/CopyFromPreviousModal'
import { AuctionPlan, ExportFormat } from '@/types/application'
import { ArrowLeft } from 'lucide-react'

export default function ApplicationEditPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const applicationId = id ?? 'new'

  const { app, isLoading, isDirty, updateAnnouncement, updateAuctionPlan, updateCriteria, setExportFormat, addExportedFile, refreshCapacity, save } =
    useApplication(applicationId)

  const { profile } = useCapacityProfile()
  const { statusLabel } = useAutoSave(app, save, isDirty)

  const [copyOpen, setCopyOpen] = useState(false)

  // Sync capacity snapshot from profile on load
  useEffect(() => {
    if (app && profile && app.capacitySnapshot.totalCapacityScore === 0) {
      refreshCapacity({
        scoreI: 0,
        scoreII: profile.scoreII,
        scoreIV1to4: profile.scoreIV1to4,
        scoreIV5: profile.scoreIV5,
        scoreIV6to8: profile.scoreIV6to8,
        scoreIV9: profile.scoreIV9,
        totalCapacityScore: profile.totalCapacityScore,
        warnings: profile.warnings,
        snapshotAt: new Date().toISOString(),
      })
    }
  }, [app?.id, profile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to the persisted URL when a new application is created
  useEffect(() => {
    if (applicationId === 'new' && app?.id && app.id !== 'new') {
      // App was just created — update URL without remounting
      window.history.replaceState(null, '', `/ho-so-du-tuyen/${app.id}`)
    }
  }, [applicationId, app?.id])

  const handleCopyPlan = useCallback(
    (plan: Partial<AuctionPlan>) => {
      updateAuctionPlan(plan)
    },
    [updateAuctionPlan]
  )

  const handleExported = useCallback(() => {
    addExportedFile({
      url: '',
      name: `HoSo-${new Date().toISOString().slice(0, 10)}.${app?.exportFormat === 'SEPARATED' ? 'zip' : 'docx'}`,
      exportedAt: new Date().toISOString(),
    })
  }, [addExportedFile, app?.exportFormat])

  if (isLoading || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Score header — sticky */}
      <ApplicationScoreHeader app={app} statusLabel={statusLabel} />

      {/* Page header */}
      <div className="max-w-4xl mx-auto px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => navigate('/portal/ho-so-du-tuyen')}
          >
            <ArrowLeft className="h-4 w-4" />
            Danh sách hồ sơ
          </Button>
        </div>
        <h1 className="text-base font-bold text-foreground mt-2">Lập hồ sơ dự tuyển đấu giá</h1>
        <p className="text-xs text-muted-foreground">Theo Thông tư 19/2024/TT-BTP — Phụ lục I</p>
      </div>

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-4 pb-16 space-y-4">
        {/* Section 1 */}
        <div>
          <SectionLabel number={1} title="Thông tin thông báo lựa chọn" />
          <Section1Announcement announcement={app.announcement} onChange={updateAnnouncement} />
        </div>

        {/* Section 2 */}
        <div>
          <SectionLabel number={2} title="Năng lực tổ chức" subtitle="(Auto · 76 điểm)" />
          <Section2CapacitySummary profile={profile} />
        </div>

        {/* Section 3 */}
        <div>
          <SectionLabel number={3} title="Phương án đấu giá" subtitle="(Mục III · 16 điểm)" />
          <Section3AuctionPlan
            auctionPlan={app.auctionPlan}
            onChange={updateAuctionPlan}
            onCopyFromPrevious={() => setCopyOpen(true)}
          />
        </div>

        {/* Section 4 */}
        <div>
          <SectionLabel number={4} title="Tiêu chí khác" subtitle="(Mục V · tối đa 8 điểm)" />
          <Section4SectionVCriteria criteria={app.sectionVCriteria} onChange={updateCriteria} />
        </div>

        {/* Section 5 */}
        <div>
          <SectionLabel number={5} title="Kiểm tra & Xuất file" />
          <Section5Export
            app={app}
            profile={profile}
            onFormatChange={(f: ExportFormat) => setExportFormat(f)}
            onExported={handleExported}
          />
        </div>
      </div>

      {/* Copy from previous modal */}
      <CopyFromPreviousModal
        open={copyOpen}
        onOpenChange={setCopyOpen}
        currentId={app.id}
        currentCategory={app.announcement.assetCategory as string}
        onCopyPlan={handleCopyPlan}
      />
    </div>
  )
}

function SectionLabel({
  number,
  title,
  subtitle,
}: {
  number: number
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
        {number}
      </span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  )
}
