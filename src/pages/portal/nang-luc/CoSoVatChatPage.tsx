import { useState } from 'react'
import { Pencil, CheckCheck, Shield, Camera, Globe, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScoreInlineBar } from '@/components/portal/ScoreInlineBar'
import { ScoreBreakdownDialog } from '@/components/portal/ScoreBreakdownDialog'
import { MUC_II_BREAKDOWN } from '@/lib/portal/scoreBreakdowns'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useInfrastructure } from '@/hooks/useInfrastructure'
import { SuggestionsCard } from '@/components/infrastructure/SuggestionsCard'
import { InfraScoreCards } from '@/components/infrastructure/InfraScoreCards'
import { HeadquartersSection } from '@/components/infrastructure/sections/HeadquartersSection'
import { ReceptionPointSection } from '@/components/infrastructure/sections/ReceptionPointSection'
import { CameraSection } from '@/components/infrastructure/sections/CameraSection'
import { WebsiteSection } from '@/components/infrastructure/sections/WebsiteSection'
import { OnlineAuctionSection } from '@/components/infrastructure/sections/OnlineAuctionSection'
import { ArchiveSection } from '@/components/infrastructure/sections/ArchiveSection'
import {
  HeadquartersSectionView,
  ReceptionPointSectionView,
  CameraSectionView,
  WebsiteAndAuctionSectionView,
  ArchiveSectionView,
} from '@/components/infrastructure/sections/InfraSectionViews'
import type { Headquarters, ReceptionPoint, CameraSystem, CameraAtAuction, Website, OnlineAuctionPlatform, Archive } from '@/types/infrastructure'

type SectionKey = 'csvc' | 'trangbi' | 'website' | 'archive'

function EditDoneBar({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex justify-end px-5 pb-4">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onDone}>
        <CheckCheck className="h-3.5 w-3.5" />Xong
      </Button>
    </div>
  )
}

export default function CoSoVatChatPage() {
  const {
    infra,
    updateSection,
    scoreBreakdown,
    totalScore,
    suggestions,
    onlineAuctionsLastYear,
  } = useInfrastructure()

  const [editingSection, setEditingSection] = useState<SectionKey | null>(null)
  const [openSections, setOpenSections] = useState<string[]>([])

  const SECTION_MAP: Record<string, { accordion: SectionKey }> = {
    headquarters: { accordion: 'csvc' },
    receptionPoint: { accordion: 'csvc' },
    camera: { accordion: 'trangbi' },
    website: { accordion: 'website' },
    onlineAuction: { accordion: 'website' },
    archive: { accordion: 'archive' },
  }

  function navigateToSection(sectionId: string) {
    const mapping = SECTION_MAP[sectionId]
    if (!mapping) return
    const key = mapping.accordion
    setOpenSections((prev) => prev.includes(key) ? prev : [...prev, key])
    setEditingSection(key)
    setTimeout(() => {
      document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  function editButton(key: SectionKey) {
    if (editingSection === key) return null
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs text-muted-foreground mr-2 shrink-0"
        onClick={(e) => { e.stopPropagation(); setEditingSection(key) }}
      >
        <Pencil className="h-3 w-3" />Sửa
      </Button>
    )
  }

  const scoreBadge = (val: number, max: number) => (
    <span className={`text-xs rounded-full px-2 py-0.5 ${val >= max ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
      {val}/{max}đ
    </span>
  )

  const csvcScore = scoreBreakdown.II_1_1 + scoreBreakdown.II_1_2

  return (
    <div className="px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Cơ sở vật chất</h1>
        <div className="flex items-center gap-1.5">
          <ScoreInlineBar label="Mục II" score={totalScore} max={19} />
          <ScoreBreakdownDialog data={MUC_II_BREAKDOWN} />
        </div>
      </div>

      <InfraScoreCards breakdown={scoreBreakdown} />

      <SuggestionsCard suggestions={suggestions} onNavigate={navigateToSection} />

      <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-2">
        {/* CSVC đảm bảo (trụ sở + tiếp nhận) */}
        <AccordionItem id="section-csvc" value="csvc" className="border rounded-2xl px-0 overflow-hidden">
          <AccordionTrigger className="px-5 py-3 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium flex-1 min-w-0">
              <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />CSVC đảm bảo
              {scoreBadge(csvcScore, 3)}
            </span>
            {editButton('csvc')}
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            {editingSection === 'csvc' ? (
              <>
                <HeadquartersSection
                  data={infra.headquarters}
                  score={scoreBreakdown.II_1_1}
                  onChange={(p) => updateSection('headquarters', p as Partial<Headquarters>)}
                />
                <ReceptionPointSection
                  data={infra.receptionPoint}
                  score={scoreBreakdown.II_1_2}
                  onChange={(p) => updateSection('receptionPoint', p as Partial<ReceptionPoint>)}
                />
                <EditDoneBar onDone={() => setEditingSection(null)} />
              </>
            ) : (
              <div className="divide-y">
                <HeadquartersSectionView data={infra.headquarters} />
                <ReceptionPointSectionView data={infra.receptionPoint} />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Trang bị (camera) */}
        <AccordionItem id="section-trangbi" value="trangbi" className="border rounded-2xl px-0 overflow-hidden">
          <AccordionTrigger className="px-5 py-3 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium flex-1 min-w-0">
              <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />Trang bị
              {scoreBadge(scoreBreakdown.II_2_1 + scoreBreakdown.II_2_2, 4)}
            </span>
            {editButton('trangbi')}
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            {editingSection === 'trangbi' ? (
              <>
                <CameraSection
                  officeData={infra.cameraAtOffice}
                  auctionData={infra.cameraAtAuction}
                  officeScore={scoreBreakdown.II_2_1}
                  auctionScore={scoreBreakdown.II_2_2}
                  onOfficeChange={(p) => updateSection('cameraAtOffice', p as Partial<CameraSystem>)}
                  onAuctionChange={(p) => updateSection('cameraAtAuction', p as Partial<CameraAtAuction>)}
                />
                <EditDoneBar onDone={() => setEditingSection(null)} />
              </>
            ) : (
              <CameraSectionView officeData={infra.cameraAtOffice} auctionData={infra.cameraAtAuction} />
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Website */}
        <AccordionItem id="section-website" value="website" className="border rounded-2xl px-0 overflow-hidden">
          <AccordionTrigger className="px-5 py-3 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium flex-1 min-w-0">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />Website
              {scoreBadge(scoreBreakdown.II_3 + scoreBreakdown.II_4, 8)}
            </span>
            {editButton('website')}
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            {editingSection === 'website' ? (
              <>
                <div className="space-y-4 px-3">
                  <WebsiteSection
                    data={infra.website}
                    score={scoreBreakdown.II_3}
                    onChange={(p) => updateSection('website', p as Partial<Website>)}
                  />
                  <OnlineAuctionSection
                    data={infra.onlineAuctionPlatform}
                    score={scoreBreakdown.II_4}
                    onlineAuctionsLastYear={onlineAuctionsLastYear}
                    onChange={(p) => updateSection('onlineAuctionPlatform', p as Partial<OnlineAuctionPlatform>)}
                  />
                </div>
                <EditDoneBar onDone={() => setEditingSection(null)} />
              </>
            ) : (
              <WebsiteAndAuctionSectionView websiteData={infra.website} auctionData={infra.onlineAuctionPlatform} />
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Lưu trữ hồ sơ */}
        <AccordionItem id="section-archive" value="archive" className="border rounded-2xl px-0 overflow-hidden">
          <AccordionTrigger className="px-5 py-3 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium flex-1 min-w-0">
              <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />Lưu trữ hồ sơ
              {scoreBadge(scoreBreakdown.II_5, 4)}
            </span>
            {editButton('archive')}
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            {editingSection === 'archive' ? (
              <>
                <ArchiveSection
                  data={infra.archive}
                  score={scoreBreakdown.II_5}
                  onChange={(p) => updateSection('archive', p as Partial<Archive>)}
                />
                <EditDoneBar onDone={() => setEditingSection(null)} />
              </>
            ) : (
              <ArchiveSectionView data={infra.archive} />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
