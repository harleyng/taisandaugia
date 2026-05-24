import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, ExternalLink, ArrowRight } from 'lucide-react'
import { CapacityProfile } from '@/types/capacity-profile'

interface Props {
  profile: CapacityProfile
}

function ScoreRow({
  label,
  score,
  max,
  ok,
}: {
  label: string
  score: number
  max: number
  ok: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-sm">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        )}
        <span>{label}</span>
      </div>
      <Badge variant={ok ? 'secondary' : 'outline'} className="text-xs">
        {score}/{max}đ
      </Badge>
    </div>
  )
}

export function Section2CapacitySummary({ profile }: Props) {
  const navigate = useNavigate()

  const totalMax = 76

  return (
    <Card className="p-5 bg-blue-50/30 border-blue-100">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Năng lực tổ chức{' '}
            <Badge variant="secondary" className="ml-1 text-xs">
              Auto từ Hồ sơ năng lực
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dữ liệu năng lực thường trực (Mục I, II, IV) — chỉ đọc
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs shrink-0"
          onClick={() => navigate('/profile')}
        >
          Sửa hồ sơ năng lực
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {/* Warnings */}
      {profile.warnings.length > 0 && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
          {profile.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-800">{w}</p>
                {profile.auctionsMissingPrice > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-amber-700 mt-0.5"
                    onClick={() => navigate('/profile?tab=company&section=auction-history&filter=missing')}
                  >
                    Fill ngay <ArrowRight className="h-3 w-3 ml-0.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Score rows */}
      <div className="mb-3">
        <ScoreRow
          label={`Mục I: Đăng ký danh sách Bộ Tư pháp`}
          score={profile.onMinistryList ? 0 : 0}
          max={0}
          ok={profile.onMinistryList}
        />
        <ScoreRow label="Mục II: Cơ sở vật chất" score={profile.scoreII} max={19} ok={profile.scoreII >= 14} />
        <ScoreRow
          label={`Mục IV.1-4: Lịch sử đấu giá (${profile.auctionsCompleted} cuộc)`}
          score={profile.scoreIV1to4}
          max={21}
          ok={profile.auctionsMissingPrice === 0}
        />
        <ScoreRow
          label={`Mục IV.5: Thời gian hoạt động ${profile.yearsActive} năm`}
          score={profile.scoreIV5}
          max={5}
          ok={profile.scoreIV5 >= 3}
        />
        <ScoreRow
          label={`Mục IV.6-8: Đấu giá viên (${profile.auctioneerCount} người)`}
          score={profile.scoreIV6to8}
          max={9}
          ok={profile.scoreIV6to8 >= 6}
        />
        <ScoreRow
          label={`Mục IV.9: Thuế năm trước ${profile.taxPaidPreviousYear.toLocaleString('vi-VN')} triệu`}
          score={profile.scoreIV9}
          max={3}
          ok={profile.scoreIV9 >= 3}
        />
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-lg bg-white border border-blue-200 px-4 py-3">
        <span className="text-sm font-medium">Tổng năng lực</span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-primary">{profile.totalCapacityScore}</span>
          <span className="text-sm text-muted-foreground">/{totalMax}đ</span>
        </div>
      </div>
    </Card>
  )
}
