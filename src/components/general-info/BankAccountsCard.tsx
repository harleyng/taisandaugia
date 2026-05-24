import { Landmark, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SensitiveFieldMask } from './SensitiveFieldMask'
import type { BankAccount } from '@/types/general-info'

interface BankAccountsCardProps {
  accounts: BankAccount[]
  onAdd: () => void
  onEdit: (account: BankAccount) => void
  onRemove: (id: string) => void
}

export function BankAccountsCard({ accounts, onAdd, onEdit, onRemove }: BankAccountsCardProps) {
  return (
    <Card>
      <Accordion type="single" collapsible>
        <AccordionItem value="banks" className="border-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Landmark className="h-4 w-4" />
              Tài khoản ngân hàng
              <span className="text-xs font-normal text-muted-foreground">(riêng tư)</span>
              {accounts.length > 0 && (
                <Badge variant="secondary" className="text-xs font-normal">{accounts.length}</Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <CardContent className="pt-0 pb-4 space-y-3">
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Chưa có tài khoản ngân hàng</p>
              )}

              {accounts.map((account) => (
                <div key={account.id} className="flex items-start gap-2 group">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">{account.bankName}</span>
                      {account.isPrimary && (
                        <Badge variant="default" className="text-xs font-normal">Chính</Badge>
                      )}
                    </div>
                    {account.branch && (
                      <p className="text-xs text-muted-foreground">CN {account.branch}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      STK: <SensitiveFieldMask value={account.accountNumber} />
                    </div>
                    <p className="text-xs text-muted-foreground">Chủ TK: {account.accountHolder}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(account)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onRemove(account.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={onAdd}>
                <Plus className="h-4 w-4" />
                Thêm tài khoản
              </Button>
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}
