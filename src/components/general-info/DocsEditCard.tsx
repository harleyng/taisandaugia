import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { EstablishmentSection } from './sections/EstablishmentSection'
import type { UseFormReturn } from 'react-hook-form'
import type { EditFormValues } from './EditInfoSheet'

interface Props {
  form: UseFormReturn<EditFormValues>
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

export function DocsEditCard({ form, saving, onSave, onCancel }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Giấy tờ pháp lý</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onCancel}>
            Hủy
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <EstablishmentSection form={form} />
        </Form>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onCancel}>Hủy</Button>
          <Button size="sm" disabled={saving} onClick={onSave}>Lưu thay đổi</Button>
        </div>
      </CardContent>
    </Card>
  )
}
