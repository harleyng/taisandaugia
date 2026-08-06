import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Globe, Lock, UserRound } from 'lucide-react'
import type { Auctioneer } from '@/types/auctioneer'
import { POSITION_LABELS, computePracticeYears } from '@/types/auctioneer'

interface Props {
  person: Auctioneer
  onSave: (patch: Partial<Auctioneer>) => void
}

/**
 * Bật/tắt hiển thị công khai + xem trước ĐÚNG những gì khách vãng lai thấy.
 *
 * Bản xem trước này phải khớp với RPC public_org_auctioneers — đó mới là thứ
 * quyết định dữ liệu ra ngoài, không phải component nào ở đây.
 */
export function PublicProfileCard({ person, onSave }: Props) {
  const isPublic = person.isPublicProfile ?? false
  const title = person.publicTitle?.trim() || POSITION_LABELS[person.position]
  const years = computePracticeYears(person)

  return (
    <Card className="p-5 rounded-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            {isPublic ? <Globe className="h-4 w-4 text-success" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
            Công khai trên sàn
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Khi bật, người này xuất hiện ở mục “Đội ngũ đấu giá viên” trên trang tổ chức.
            Miễn phí.
          </p>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={(v) => onSave({ isPublicProfile: v })}
        />
      </div>

      {isPublic && (
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Khoe chỉ số đấu giá</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hiện thêm số cuộc đã điều hành, tổng giá trúng và danh mục sở trường —
              lấy từ mục Lịch sử đấu giá. Tắt thì chỉ hiện thông tin hành nghề.
            </p>
          </div>
          <Switch
            checked={person.showPublicStats ?? false}
            onCheckedChange={(v) => onSave({ showPublicStats: v })}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Chức danh hiển thị</Label>
        <Input
          defaultValue={person.publicTitle ?? ''}
          placeholder={POSITION_LABELS[person.position]}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v !== (person.publicTitle ?? '')) onSave({ publicTitle: v })
          }}
        />
        <p className="text-xs text-muted-foreground">
          Để trống sẽ dùng chức vụ mặc định “{POSITION_LABELS[person.position]}”.
        </p>
      </div>

      <div className="rounded-lg border bg-secondary/40 p-3 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Xem trước công khai
        </p>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-background">
            {person.portraitUrl ? (
              <img src={person.portraitUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <UserRound className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{person.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {title} · Thẻ {person.licenseNumber} · {years} năm kinh nghiệm
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline" className="text-xs font-normal">
            Không chia sẻ: CCCD · giấy tờ · email · điện thoại · ghi chú nội bộ
          </Badge>
        </div>
      </div>
    </Card>
  )
}
