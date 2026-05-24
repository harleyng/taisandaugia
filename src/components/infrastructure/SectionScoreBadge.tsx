interface Props {
  current: number
  max: number
}

export function SectionScoreBadge({ current, max }: Props) {
  const isMax = current >= max
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isMax
          ? 'bg-green-100 text-green-700'
          : current > 0
            ? 'bg-amber-100 text-amber-700'
            : 'bg-muted text-muted-foreground'
      }`}
    >
      {current}/{max}đ
    </span>
  )
}
