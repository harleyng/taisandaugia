import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        )}
        <span className={ok ? '' : 'text-foreground'}>{label}</span>
      </div>
      <span className="text-xs font-medium text-muted-foreground shrink-0 pl-3">
        {score}/{max}
      </span>
    </div>
  )
}

export function Section2CapacitySummary({ profile }: Props) {
  const navigate = useNavigate()

  const totalMax = 76

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs text-muted-foreground">Tự động lấy từ hồ sơ năng lực — chỉ đọc</p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 shrink-0 text-muted-foreground"
          onClick={() => navigate('/profile')}
        >
          Sửa <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {/* Warnings */}
      {profile.warnings.length > 0 && (
        <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 space-y-1">
          {profile.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-800 flex-1">{w}</p>
              {profile.auctionsMissingPrice > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-amber-700 shrink-0"
                  onClick={() => navigate('/profile?tab=company&section=auction-history&filter=missing')}
                >
                  Bổ sung <ArrowRight className="h-3 w-3 ml-0.5" />
                </Button>
              )}
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
      <div className="flex items-center justify-between pt-2 mt-1">
        <span className="text-xs font-medium text-muted-foreground">Tổng năng lực</span>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-primary">{profile.totalCapacityScore}</span>
          <span className="text-xs text-muted-foreground">/{totalMax}đ</span>
        </div>
      </div>
    </Card>
  )
}
