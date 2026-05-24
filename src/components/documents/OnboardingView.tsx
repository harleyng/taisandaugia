import { Folder, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DEFAULT_FOLDER_NAMES } from '@/types/document'

interface Props {
  onStart: () => void
}

export function OnboardingView({ onStart }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-primary/10 rounded-full p-4">
              <Folder className="h-10 w-10 text-primary" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Bắt đầu với Tủ tài liệu</h2>
            <p className="text-muted-foreground text-sm">
              Chúng tôi đã tạo sẵn 7 folder phổ biến để bạn bắt đầu nhanh chóng.
            </p>
          </div>

          <div className="text-left space-y-2">
            {DEFAULT_FOLDER_NAMES.map((name) => (
              <div
                key={name}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50 text-sm"
              >
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{name}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Bạn có thể đổi tên, xóa, hoặc tạo thêm folder bất kỳ lúc nào.
          </p>

          <Button onClick={onStart} className="w-full gap-2">
            <Rocket className="h-4 w-4" />
            Bắt đầu sử dụng
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
