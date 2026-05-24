import { TagBadge } from '../shared/TagBadge'
import type { DocumentFilter } from '@/types/document'

interface Props {
  tags: string[]
  filter: DocumentFilter
  setFilter: (patch: Partial<DocumentFilter>) => void
}

export function TagCloud({ tags, filter, setFilter }: Props) {
  if (tags.length === 0) return null

  const toggleTag = (tag: string) => {
    const active = filter.tags.includes(tag)
    setFilter({
      tags: active ? filter.tags.filter((t) => t !== tag) : [...filter.tags, tag],
    })
  }

  return (
    <div className="px-2">
      <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
        Tags
      </p>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <button key={tag} onClick={() => toggleTag(tag)}>
            <TagBadge
              tag={tag}
              className={
                filter.tags.includes(tag)
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : ''
              }
            />
          </button>
        ))}
      </div>
    </div>
  )
}
