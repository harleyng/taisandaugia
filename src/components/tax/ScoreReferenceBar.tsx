interface Props {
  amountVnd: number
}

const TIERS = [
  { label: '< 50 triệu', points: 1, min: 0, max: 50 },
  { label: '50 – 100 triệu', points: 2, min: 50, max: 100 },
  { label: '≥ 100 triệu', points: 3, min: 100, max: Infinity },
]

export function ScoreReferenceBar({ amountVnd }: Props) {
  const millions = amountVnd / 1_000_000

  function isActive(tier: (typeof TIERS)[0]) {
    if (amountVnd <= 0) return false
    return millions >= tier.min && (tier.max === Infinity || millions < tier.max)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Thang điểm Mục IV.9</p>
      <div className="flex gap-1.5">
        {TIERS.map((tier) => {
          const active = isActive(tier)
          return (
            <div
              key={tier.points}
              className={`flex flex-1 flex-col items-center rounded-md px-2 py-1.5 text-xs transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="font-bold">{tier.points}đ</span>
              <span className="mt-0.5 text-center leading-tight opacity-80">{tier.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
