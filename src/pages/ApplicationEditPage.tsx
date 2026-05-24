import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useApplication } from '@/hooks/useApplication'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useCapacityProfile } from '@/hooks/useCapacityProfile'
import { Badge } from '@/components/ui/badge'
import { Section1Announcement } from '@/components/applications/sections/Section1Announcement'
import { Section2CapacitySummary } from '@/components/applications/sections/Section2CapacitySummary'
import { Section3AuctionPlan } from '@/components/applications/sections/Section3AuctionPlan/Section3AuctionPlan'
import { Section4SectionVCriteria } from '@/components/applications/sections/Section4Criteria/Section4SectionVCriteria'
import { Section5Export } from '@/components/applications/sections/Section5Export/Section5Export'
import { CopyFromPreviousModal } from '@/components/applications/CopyFromPreviousModal'
import { ApplicationSummaryBox } from '@/components/applications/ApplicationSummaryBox'
import { validateForExport } from '@/lib/applications/validation'
import { AuctionPlan, ExportFormat } from '@/types/application'
import { CheckCircle2 } from 'lucide-react'

export default function ApplicationEditPage() {
  const { id } = useParams<{ id?: string }>()
  const applicationId = id ?? 'new'

  const { app, isLoading, isDirty, updateAnnouncement, updateAuctionPlan, updateCriteria, setExportFormat, refreshCapacity, save } =
    useApplication(applicationId)

  const { profile } = useCapacityProfile()
  useAutoSave(app, save, isDirty)

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
      window.history.replaceState(null, '', `/portal/ho-so-du-tuyen/${app.id}`)
    }
  }, [applicationId, app?.id])

  const handleCopyPlan = useCallback(
    (plan: Partial<AuctionPlan>) => {
      updateAuctionPlan(plan)
    },
    [updateAuctionPlan]
  )

  if (isLoading || !app) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">Đang tải...</p>
      </div>
    )
  }

  const errors = validateForExport(app)
  const sec1Done = !errors.some((e) => e.section === 'Section 1')
  const sec3Done = !errors.some((e) => e.section.startsWith('Mục III'))
  const sec4Done = !errors.some((e) => e.section === 'Mục V')
  const sec5Done = !errors.some((e) => e.section === 'Section 5')

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-16">
      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-6 lg:items-start">
        {/* Left: sections */}
        <div className="space-y-4">
          <div id="section-1">
            <SectionCard number={1} title="Thông tin cuộc đấu giá" done={sec1Done}>
              <Section1Announcement announcement={app.announcement} onChange={updateAnnouncement} />
            </SectionCard>
          </div>

          <div id="section-2">
            <SectionCard number={2} title="Năng lực tổ chức" subtitle="Auto · 76 điểm" done={true}>
              <Section2CapacitySummary profile={profile} />
            </SectionCard>
          </div>

          <div id="section-3">
            <SectionCard number={3} title="Phương án đấu giá" subtitle="Mục III · 16 điểm" done={sec3Done}>
              <Section3AuctionPlan
                auctionPlan={app.auctionPlan}
                onChange={updateAuctionPlan}
                onCopyFromPrevious={() => setCopyOpen(true)}
              />
            </SectionCard>
          </div>

          <div id="section-4">
            <SectionCard number={4} title="Tiêu chí khác" subtitle="Mục V · tối đa 8 điểm" done={sec4Done}>
              <Section4SectionVCriteria criteria={app.sectionVCriteria} onChange={updateCriteria} />
            </SectionCard>
          </div>

          <div id="section-5">
            <SectionCard number={5} title="Kiểm tra & Xuất file" done={sec5Done}>
              <Section5Export
                app={app}
                profile={profile}
                onFormatChange={(f: ExportFormat) => setExportFormat(f)}
              />
            </SectionCard>
          </div>
        </div>

        {/* Right: summary box (desktop only, sticky below portal topbar) */}
        <div className="hidden lg:block sticky top-[56px]">
          <ApplicationSummaryBox app={app} />
        </div>
      </div>

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

function SectionCard({
  number,
  title,
  subtitle,
  done,
  children,
}: {
  number: number
  title: string
  subtitle?: string
  done: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
            done ? 'bg-green-100' : 'bg-primary/10'
          }`}
        >
          {done ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <span className="text-primary">{number}</span>
          )}
        </div>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {subtitle && <span className="text-xs text-muted-foreground">· {subtitle}</span>}
        {done && (
          <Badge variant="outline" className="ml-auto border-green-300 text-green-600 text-[10px]">
            Hoàn thành
          </Badge>
        )}
      </div>
      {children}
    </div>
  )
}
