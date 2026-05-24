import { FileText, Paperclip } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { format, parseISO, isValid } from 'date-fns'
import type { OrgGeneralInfo } from '@/types/general-info'

interface EstablishmentDocumentsCardProps {
  info: OrgGeneralInfo
}

function fmtDate(d?: string) {
  if (!d) return null
  try {
    const parsed = parseISO(d)
    return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : null
  } catch { return null }
}

interface DocRowProps {
  title: string
  number?: string
  date?: string
  issuer?: string
  file?: string
}

function DocRow({ title, number, date, issuer, file }: DocRowProps) {
  const hasAny = number || date || issuer || file
  if (!hasAny) return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">Chưa nhập</p>
    </div>
  )
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {number && <p className="text-xs text-muted-foreground">Số: <span className="text-foreground">{number}</span></p>}
      {(date || issuer) && (
        <p className="text-xs text-muted-foreground">
          {fmtDate(date) && <>Ngày {fmtDate(date)}</>}
          {date && issuer && ' · '}
          {issuer && <>Cấp bởi: {issuer}</>}
        </p>
      )}
      {file && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Paperclip className="h-3 w-3" />
          {file}
        </p>
      )}
    </div>
  )
}

export function EstablishmentDocumentsCard({ info }: EstablishmentDocumentsCardProps) {
  return (
    <Card>
      <Accordion type="single" collapsible defaultValue="">
        <AccordionItem value="docs" className="border-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" />
              Giấy tờ pháp lý
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <CardContent className="pt-0 pb-4 space-y-4">
              <DocRow
                title="Quyết định thành lập"
                number={info.establishmentDecisionNumber}
                date={info.establishmentDecisionDate}
                issuer={info.establishmentDecisionIssuer}
                file={info.establishmentDecisionFile}
              />
              <DocRow
                title="Giấy đăng ký hoạt động"
                number={info.businessLicenseNumber}
                date={info.businessLicenseDate}
                issuer={info.businessLicenseIssuer}
                file={info.businessLicenseFile}
              />
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}
