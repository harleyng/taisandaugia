import { useNavigate } from 'react-router-dom'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOrg } from '@/contexts/OrgContext'
import type { ReactNode } from 'react'

/**
 * /portal trước đây chỉ gác bằng ProtectedRoute (có session là vào được), nên
 * một người mua thường cũng mở được portal và thấy trang trống. Cổng này yêu
 * cầu có ÍT NHẤT một membership ACTIVE.
 *
 * KHÔNG gate theo kyc_status: portal vốn dùng được khi tổ chức còn PENDING_KYC,
 * siết thêm sẽ làm hồi quy luồng onboarding.
 */
export function PortalNoOrgGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { orgs, loading } = useOrg()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (orgs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            Bạn chưa thuộc tổ chức đấu giá nào
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Đăng ký tổ chức đấu giá để sử dụng portal, hoặc chờ quản trị viên của tổ chức
            gửi lời mời cho bạn.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => navigate('/dang-ky-to-chuc')}>Đăng ký tổ chức</Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              Về trang chủ
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
