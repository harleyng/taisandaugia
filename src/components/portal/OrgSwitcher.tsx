import { useNavigate } from 'react-router-dom'
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useOrg } from '@/contexts/OrgContext'

/**
 * Chuyển giữa các tổ chức mà người dùng là thành viên.
 *
 * ẨN khi chỉ thuộc 1 tổ chức — không chỉ để gọn giao diện: hồ sơ năng lực và hồ
 * sơ dự tuyển hiện vẫn nằm ở localStorage theo TRÌNH DUYỆT, chưa tách theo tổ
 * chức, nên đổi tổ chức sẽ hiện nhầm dữ liệu. Bỏ điều kiện ẩn này sau khi dữ
 * liệu đã chuyển sang Supabase.
 */
interface Props {
  /** Lớp cho khối bọc — nằm trong component để khi switcher tự ẩn thì khoảng
   *  đệm / đường kẻ ngăn cách ở sidebar cũng biến mất theo. */
  className?: string
}

export function OrgSwitcher({ className }: Props) {
  const navigate = useNavigate()
  const { orgs, currentOrg, setCurrentOrg } = useOrg()

  if (orgs.length <= 1) return null

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm transition-colors hover:bg-muted">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-left font-medium text-foreground">
              {currentOrg?.name ?? 'Chọn tổ chức'}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[14rem]"
        >
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Tổ chức của bạn
          </DropdownMenuLabel>
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => setCurrentOrg(org.id)}
              className="gap-2"
            >
              <Check
                className={[
                  'h-4 w-4 shrink-0',
                  org.id === currentOrg?.id ? 'opacity-100 text-primary' : 'opacity-0',
                ].join(' ')}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{org.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {org.roleName}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/dang-ky-to-chuc')}>
            <Plus className="mr-2 h-4 w-4" />
            Đăng ký tổ chức mới
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
