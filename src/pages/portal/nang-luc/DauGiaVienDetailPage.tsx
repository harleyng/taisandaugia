import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { usePersonnelDossier } from '@/hooks/usePersonnelDossier'
import { POSITION_LABELS, computePracticeYears } from '@/types/auctioneer'
import { DossierCompletenessBar } from '@/components/personnel/DossierCompletenessBar'
import { IdentitySection } from '@/components/personnel/IdentitySection'
import { DocumentsSection } from '@/components/personnel/DocumentsSection'
import { CareerSection } from '@/components/personnel/CareerSection'
import { TrainingSection } from '@/components/personnel/TrainingSection'
import { PublicProfileCard } from '@/components/personnel/PublicProfileCard'
import { ConductedAuctionsCard } from '@/components/personnel/ConductedAuctionsCard'

/**
 * Chi tiết một đấu giá viên — NƠI DỮ LIỆU SỐNG.
 *
 * Màn Hồ sơ nhân sự (/portal/nhan-su) chỉ kết xuất, không nhập gì. Mọi thông
 * tin về con người được khai báo ở đây, thuộc cụm Hồ sơ năng lực.
 */
export default function DauGiaVienDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    person, documents, events, cpdExemptions, completeness, organizationId, isLoading,
    savePerson, saveDocument, removeDocument, saveEvent, removeEvent,
  } = usePersonnelDossier(id)

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <Card className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground rounded-2xl">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải hồ sơ…
        </Card>
      </div>
    )
  }

  if (!person || !organizationId) {
    return (
      <div className="px-6 py-6">
        <Card className="p-10 text-center space-y-3 rounded-2xl">
          <p className="text-sm font-medium">Không tìm thấy đấu giá viên</p>
          <Button size="sm" onClick={() => navigate('/portal/nang-luc/dau-gia-vien')}>
            Quay lại danh sách
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 -ml-2"
        onClick={() => navigate('/portal/nang-luc/dau-gia-vien')}
      >
        <ArrowLeft className="h-4 w-4" />
        Đấu giá viên
      </Button>

      <Card className="p-5 rounded-2xl">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-secondary">
            {person.portraitUrl ? (
              <img src={person.portraitUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg text-muted-foreground">
                {person.fullName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{person.fullName}</h1>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <Badge variant="secondary" className="text-xs font-normal">
                {POSITION_LABELS[person.position]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Thẻ {person.licenseNumber} · {computePracticeYears(person)} năm hành nghề
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <DossierCompletenessBar completeness={completeness} />
        </div>
      </Card>

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity">Định danh</TabsTrigger>
          <TabsTrigger value="documents">Giấy tờ</TabsTrigger>
          <TabsTrigger value="career">Quá trình & Đào tạo</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-4 space-y-5">
          <IdentitySection
            person={person}
            organizationId={organizationId}
            saving={savePerson.isPending}
            onSave={(patch) => savePerson.mutate(patch)}
          />
          <PublicProfileCard person={person} onSave={(patch) => savePerson.mutate(patch)} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsSection
            organizationId={organizationId}
            auctioneerId={person.id}
            documents={documents}
            onSave={(doc) => saveDocument.mutate(doc)}
            onDelete={(docId) => removeDocument.mutate(docId)}
          />
        </TabsContent>

        <TabsContent value="career" className="mt-4 space-y-5">
          <CareerSection
            events={events}
            onSave={(ev) => saveEvent.mutate(ev)}
            onDelete={(evId) => removeEvent.mutate(evId)}
          />
          {/* Chỉ ĐỌC: cuộc đấu giá thuộc module Lịch sử đấu giá, sửa ở đó. */}
          <ConductedAuctionsCard auctioneerId={person.id} fullName={person.fullName} />
          <TrainingSection
            events={events}
            exemptions={cpdExemptions}
            organizationId={organizationId}
            auctioneerId={person.id}
            onSave={(ev) => saveEvent.mutate(ev)}
            onDelete={(evId) => removeEvent.mutate(evId)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
