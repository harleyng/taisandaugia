import { MapPin, Phone, User, CreditCard, Printer, Mail, Globe, Calendar, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CompanyAvatar } from './CompanyAvatar'
import { InfoField } from './InfoField'
import type { OrgGeneralInfo } from '@/types/general-info'
import { ORG_TYPE_LABELS } from '@/types/general-info'
import { format, parseISO, isValid } from 'date-fns'

interface CompanyProfileCardProps {
  info: OrgGeneralInfo
  onEdit?: () => void
}

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null
  try {
    const d = parseISO(dateStr)
    return isValid(d) ? format(d, 'dd/MM/yyyy') : null
  } catch {
    return null
  }
}

function buildFullAddress(info: OrgGeneralInfo): string {
  const parts = [info.address, info.ward, info.district, info.province].filter(Boolean)
  return parts.join(', ')
}

export function CompanyProfileCard({ info, onEdit }: CompanyProfileCardProps) {
  const fullAddress = buildFullAddress(info)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Đơn vị tổ chức đấu giá</CardTitle>
          {onEdit && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={onEdit}>
              <Pencil className="h-3 w-3" />Sửa
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company identity header */}
        <div className="flex gap-4 items-start">
          <CompanyAvatar name={info.name} logoUrl={info.logoUrl} size="md" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground leading-tight">{info.name}</h2>
            {info.shortName && (
              <p className="text-xs text-muted-foreground">{info.shortName}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{info.province}</p>
            <Badge variant="secondary" className="mt-1.5 text-xs font-normal">
              {ORG_TYPE_LABELS[info.orgType]}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* 2-column info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <InfoField icon={MapPin} label="Địa chỉ" value={fullAddress} />
          <InfoField icon={Printer} label="Fax" value={info.fax} />
          <InfoField icon={Phone} label="Số điện thoại" value={info.phone} />
          <InfoField icon={Mail} label="Email" value={info.email} />
          <InfoField icon={User} label="Đại diện pháp lý" value={info.legalRepName} />
          <InfoField icon={Globe} label="Website" value={info.website} />
          <InfoField icon={CreditCard} label="Mã định danh" value={info.registrationCode} />
          <InfoField
            icon={Calendar}
            label="Ngày thành lập"
            value={formatDate(info.foundedDate)}
          />
        </div>

        <Separator />

        <p className="text-xs text-muted-foreground">
          MST: <span className="font-mono font-medium text-foreground">{info.taxCode}</span>
        </p>
      </CardContent>
    </Card>
  )
}
