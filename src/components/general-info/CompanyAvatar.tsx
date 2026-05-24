interface CompanyAvatarProps {
  name: string
  logoUrl?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-14 w-14 text-lg',
  lg: 'h-20 w-20 text-2xl',
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export function CompanyAvatar({ name, logoUrl, size = 'md' }: CompanyAvatarProps) {
  const sizeClass = SIZE_CLASSES[size]
  const initials = getInitials(name || 'TC')

  if (logoUrl) {
    return (
      <div className={`${sizeClass} rounded-xl overflow-hidden shrink-0 border border-border`}>
        <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`${sizeClass} rounded-xl bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-primary`}>
      {initials}
    </div>
  )
}
