import { MapPin, Plus, Pencil, Trash2, Store } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InfoBox } from '@/components/shared/InfoBox'
import type { Branch } from '@/types/general-info'

interface BranchesCardProps {
  branches: Branch[]
  onAdd: () => void
  onEdit: (branch: Branch) => void
  onRemove: (id: string) => void
}

export function BranchesCard({ branches, onAdd, onEdit, onRemove }: BranchesCardProps) {
  const active = branches.filter((b) => b.isActive)

  return (
    <Card>
      <Accordion type="single" collapsible>
        <AccordionItem value="branches" className="border-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Store className="h-4 w-4" />
              Chi nhánh &amp; Văn phòng đại diện
              {branches.length > 0 && (
                <Badge variant="secondary" className="text-xs font-normal">{branches.length}</Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <CardContent className="pt-0 pb-4 space-y-3">
              {/* Strategic hint */}
              <InfoBox variant="primary" className="space-y-1">
                <p className="text-xs font-medium text-primary">💡 Vì sao thêm chi nhánh quan trọng?</p>
                <p className="text-xs text-muted-foreground">
                  Khi lập hồ sơ cho tài sản ở tỉnh khác, chi nhánh tại đó có thể giúp đạt thêm điểm Mục V (tiêu chí khác).
                </p>
              </InfoBox>

              {branches.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Chưa có chi nhánh hoặc văn phòng đại diện</p>
              )}

              {branches.map((branch) => (
                <div key={branch.id} className="flex items-start gap-2 group">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">{branch.name}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {branch.type === 'BRANCH' ? 'Chi nhánh' : 'VPDD'}
                      </Badge>
                      {!branch.isActive && (
                        <Badge variant="secondary" className="text-xs font-normal text-muted-foreground">Không hoạt động</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{branch.address}, {branch.province}</p>
                    {branch.phone && <p className="text-xs text-muted-foreground">SĐT: {branch.phone}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(branch)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onRemove(branch.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={onAdd}>
                <Plus className="h-4 w-4" />
                Thêm chi nhánh / VPDD
              </Button>
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}
