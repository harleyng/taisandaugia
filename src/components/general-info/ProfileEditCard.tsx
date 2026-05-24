import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { EntityInfoSection } from './sections/EntityInfoSection'
import { AddressContactSection } from './sections/AddressContactSection'
import { LegalRepSection } from './sections/LegalRepSection'
import type { UseFormReturn } from 'react-hook-form'
import type { EditFormValues } from './EditInfoSheet'

interface Props {
  form: UseFormReturn<EditFormValues>
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

export function ProfileEditCard({ form, saving, onSave, onCancel }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Thông tin tổ chức</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onCancel}>
            Hủy
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-6">
            <EntityInfoSection form={form} />
            <Separator />
            <AddressContactSection form={form} />
            <Separator />
            <LegalRepSection form={form} />
          </div>
        </Form>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onCancel}>Hủy</Button>
          <Button size="sm" disabled={saving} onClick={onSave}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Lưu thay đổi
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
