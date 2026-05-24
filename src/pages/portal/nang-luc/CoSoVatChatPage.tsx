import { useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useInfrastructure } from '@/hooks/useInfrastructure'
import { ScoreProgressCard } from '@/components/infrastructure/ScoreProgressCard'
import { SuggestionsCard } from '@/components/infrastructure/SuggestionsCard'
import { HeadquartersSection } from '@/components/infrastructure/sections/HeadquartersSection'
import { ReceptionPointSection } from '@/components/infrastructure/sections/ReceptionPointSection'
import { CameraSection } from '@/components/infrastructure/sections/CameraSection'
import { WebsiteSection } from '@/components/infrastructure/sections/WebsiteSection'
import { OnlineAuctionSection } from '@/components/infrastructure/sections/OnlineAuctionSection'
import { ArchiveSection } from '@/components/infrastructure/sections/ArchiveSection'
import type { Headquarters, ReceptionPoint, CameraSystem, CameraAtAuction, Website, OnlineAuctionPlatform, Archive } from '@/types/infrastructure'

type ViewMode = 'tabs' | 'stacked'

const TAB_IDS = ['headquarters', 'receptionPoint', 'camera', 'website', 'archive'] as const
type TabId = typeof TAB_IDS[number]

export default function CoSoVatChatPage() {
  const {
    infra,
    updateSection,
    statusLabel,
    scoreBreakdown,
    totalScore,
    suggestions,
    onlineAuctionsLastYear,
  } = useInfrastructure()

  const [viewMode, setViewMode] = useState<ViewMode>('tabs')
  const [activeTab, setActiveTab] = useState<TabId>('headquarters')

  function navigateToSection(sectionId: string) {
    if (viewMode === 'tabs') {
      const tabMap: Record<string, TabId> = {
        headquarters: 'headquarters',
        receptionPoint: 'receptionPoint',
        camera: 'camera',
        website: 'website',
        onlineAuction: 'website',
        archive: 'archive',
      }
      const tab = tabMap[sectionId]
      if (tab) setActiveTab(tab)
    }
    setTimeout(() => {
      document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  const sections = (
    <>
      <div id="section-headquarters">
        <HeadquartersSection
          data={infra.headquarters}
          score={scoreBreakdown.II_1_1}
          onChange={(p) => updateSection('headquarters', p as Partial<Headquarters>)}
        />
      </div>
      <div id="section-receptionPoint">
        <ReceptionPointSection
          data={infra.receptionPoint}
          score={scoreBreakdown.II_1_2}
          onChange={(p) => updateSection('receptionPoint', p as Partial<ReceptionPoint>)}
        />
      </div>
      <div id="section-camera">
        <CameraSection
          officeData={infra.cameraAtOffice}
          auctionData={infra.cameraAtAuction}
          officeScore={scoreBreakdown.II_2_1}
          auctionScore={scoreBreakdown.II_2_2}
          onOfficeChange={(p) => updateSection('cameraAtOffice', p as Partial<CameraSystem>)}
          onAuctionChange={(p) => updateSection('cameraAtAuction', p as Partial<CameraAtAuction>)}
        />
      </div>
      <div id="section-website" className="space-y-4">
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
      <div id="section-archive">
        <ArchiveSection
          data={infra.archive}
          score={scoreBreakdown.II_5}
          onChange={(p) => updateSection('archive', p as Partial<Archive>)}
        />
      </div>
    </>
  )

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Cơ sở vật chất</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mục II — Phụ lục I TT 19/2024/TT-BTP</p>
        </div>
        {statusLabel && (
          <span className="text-xs text-muted-foreground self-center">{statusLabel}</span>
        )}
      </div>

      <ScoreProgressCard total={totalScore} breakdown={scoreBreakdown} />

      <SuggestionsCard suggestions={suggestions} onNavigate={navigateToSection} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Chế độ xem</p>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as ViewMode)}
          className="border rounded-lg p-0.5"
        >
          <ToggleGroupItem value="tabs" className="px-3 py-1.5 text-xs rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            Lần lượt
          </ToggleGroupItem>
          <ToggleGroupItem value="stacked" className="px-3 py-1.5 text-xs rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            Toàn bộ
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {viewMode === 'tabs' ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <TabsList className="grid grid-cols-5 w-full h-auto">
            <TabsTrigger value="headquarters" className="text-xs py-2">📍 Trụ sở</TabsTrigger>
            <TabsTrigger value="receptionPoint" className="text-xs py-2">🏢 Tiếp nhận</TabsTrigger>
            <TabsTrigger value="camera" className="text-xs py-2">📹 Camera</TabsTrigger>
            <TabsTrigger value="website" className="text-xs py-2">🌐 Web & ĐG TT</TabsTrigger>
            <TabsTrigger value="archive" className="text-xs py-2">💾 Lưu trữ</TabsTrigger>
          </TabsList>

          <TabsContent value="headquarters" className="mt-4">
            <HeadquartersSection
              data={infra.headquarters}
              score={scoreBreakdown.II_1_1}
              onChange={(p) => updateSection('headquarters', p as Partial<Headquarters>)}
            />
          </TabsContent>

          <TabsContent value="receptionPoint" className="mt-4">
            <ReceptionPointSection
              data={infra.receptionPoint}
              score={scoreBreakdown.II_1_2}
              onChange={(p) => updateSection('receptionPoint', p as Partial<ReceptionPoint>)}
            />
          </TabsContent>

          <TabsContent value="camera" className="mt-4">
            <CameraSection
              officeData={infra.cameraAtOffice}
              auctionData={infra.cameraAtAuction}
              officeScore={scoreBreakdown.II_2_1}
              auctionScore={scoreBreakdown.II_2_2}
              onOfficeChange={(p) => updateSection('cameraAtOffice', p as Partial<CameraSystem>)}
              onAuctionChange={(p) => updateSection('cameraAtAuction', p as Partial<CameraAtAuction>)}
            />
          </TabsContent>

          <TabsContent value="website" className="mt-4 space-y-4">
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
          </TabsContent>

          <TabsContent value="archive" className="mt-4">
            <ArchiveSection
              data={infra.archive}
              score={scoreBreakdown.II_5}
              onChange={(p) => updateSection('archive', p as Partial<Archive>)}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Accordion type="multiple" defaultValue={['headquarters']} className="space-y-2">
          <AccordionItem value="headquarters" className="border rounded-2xl px-0 overflow-hidden">
            <AccordionTrigger className="px-5 py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                📍 Trụ sở
                <span className={`text-xs rounded-full px-2 py-0.5 ${scoreBreakdown.II_1_1 >= 1.5 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {scoreBreakdown.II_1_1}/1.5đ
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <HeadquartersSection
                data={infra.headquarters}
                score={scoreBreakdown.II_1_1}
                onChange={(p) => updateSection('headquarters', p as Partial<Headquarters>)}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="receptionPoint" className="border rounded-2xl px-0 overflow-hidden">
            <AccordionTrigger className="px-5 py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                🏢 Tiếp nhận hồ sơ
                <span className={`text-xs rounded-full px-2 py-0.5 ${scoreBreakdown.II_1_2 >= 1.5 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {scoreBreakdown.II_1_2}/1.5đ
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <ReceptionPointSection
                data={infra.receptionPoint}
                score={scoreBreakdown.II_1_2}
                onChange={(p) => updateSection('receptionPoint', p as Partial<ReceptionPoint>)}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="camera" className="border rounded-2xl px-0 overflow-hidden">
            <AccordionTrigger className="px-5 py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                📹 Camera giám sát
                <span className={`text-xs rounded-full px-2 py-0.5 ${scoreBreakdown.II_2_1 + scoreBreakdown.II_2_2 >= 4 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {scoreBreakdown.II_2_1 + scoreBreakdown.II_2_2}/4đ
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <CameraSection
                officeData={infra.cameraAtOffice}
                auctionData={infra.cameraAtAuction}
                officeScore={scoreBreakdown.II_2_1}
                auctionScore={scoreBreakdown.II_2_2}
                onOfficeChange={(p) => updateSection('cameraAtOffice', p as Partial<CameraSystem>)}
                onAuctionChange={(p) => updateSection('cameraAtAuction', p as Partial<CameraAtAuction>)}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="website" className="border rounded-2xl px-0 overflow-hidden">
            <AccordionTrigger className="px-5 py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                🌐 Web & Đấu giá trực tuyến
                <span className={`text-xs rounded-full px-2 py-0.5 ${scoreBreakdown.II_3 + scoreBreakdown.II_4 >= 8 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {scoreBreakdown.II_3 + scoreBreakdown.II_4}/8đ
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 space-y-4">
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
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="archive" className="border rounded-2xl px-0 overflow-hidden">
            <AccordionTrigger className="px-5 py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                💾 Lưu trữ hồ sơ
                <span className={`text-xs rounded-full px-2 py-0.5 ${scoreBreakdown.II_5 >= 4 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {scoreBreakdown.II_5}/4đ
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <ArchiveSection
                data={infra.archive}
                score={scoreBreakdown.II_5}
                onChange={(p) => updateSection('archive', p as Partial<Archive>)}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  )
}
